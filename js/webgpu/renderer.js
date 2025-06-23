import Renderer from "../renderer.js";
import { structs } from "../../lib/gpu-buffer.js";
import { makeUniformBuffer, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeMirrorPass from "./mirrorPass.js";
import makeEndPass from "./endPass.js";
import { setupCamera, cameraCanvas, cameraAspectRatio, cameraSize } from "../utils/camera.js";

const effects = {
	none: null,
	plain: makePalettePass,
	palette: makePalettePass,
	customStripes: makeStripePass,
	stripes: makeStripePass,
	pride: makeStripePass,
	transPride: makeStripePass,
	trans: makeStripePass,
	image: makeImagePass,
	mirror: makeMirrorPass,
};

export default class REGLRenderer extends Renderer {
	#glMatrix;
	#device;
	#canvasContext;
	#canvasFormat;
	#renderFunc;

	#renewingDevice;
	#configureIndex = 0;
	#rebuildingPipeline;

	constructor() {
		super("webgpu", async () => {
			const libraries = await Renderer.libraries;
			this.#glMatrix = libraries.glMatrix;
		});
	}

	async configure(config) {
		const index = ++this.#configureIndex;
		await super.configure(config);
		if (config.useCamera) {
			await setupCamera();
		}

		if (this.#rebuildingPipeline != null) {
			await this.#rebuildingPipeline;
		}

		const oldDevice = this.#device;

		if (this.#renewingDevice == null) {
			this.#renewingDevice = (async () => {
				this.#canvasContext = this.canvas.getContext("webgpu");
				this.#canvasFormat = navigator.gpu.getPreferredCanvasFormat();
				const adapter = await navigator.gpu.requestAdapter();
				this.#device = await adapter.requestDevice();
			})();
		}
		await this.#renewingDevice;
		this.#renewingDevice = null;

		if (this.#configureIndex !== index || this.destroyed) {
			return;
		}

		this.#rebuildingPipeline = (async () => {
			const glMatrix = this.#glMatrix;
			const canvas = this.canvas;
			const cache = this.cache;
			const device = this.#device;
			const canvasContext = this.#canvasContext;
			const canvasFormat = this.#canvasFormat;
			const dimensions = { width: 1, height: 1 };

			const timeUniforms = structs.from(`struct Time { seconds : f32, frames : i32, };`).Time;
			const timeBuffer = makeUniformBuffer(device, timeUniforms);
			const cameraTex = device.createTexture({
				size: cameraSize,
				format: "rgba8unorm",
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT,
			});

			const context = {
				glMatrix,
				config,
				cache,
				device,
				canvas,
				canvasContext,
				canvasFormat,
				timeBuffer,
				cameraTex,
				cameraAspectRatio,
				cameraSize,
			};

			const effectName = config.effect in effects ? config.effect : "palette";
			const pipeline = await makePipeline(context, [
				makeRain,
				makeBloomPass,
				effects[effectName],
				makeEndPass,
			]);

			this.#canvasContext.configure({
				device: this.#device,
				format: this.#canvasFormat,
				alphaMode: "opaque",
				usage:
					// GPUTextureUsage.STORAGE_BINDING |
					GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
			});

			dimensions.width = canvas.width;
			dimensions.height = canvas.height;
			const targetFrameTimeMilliseconds = 1000 / config.fps;
			let frames = 0;
			let start = NaN;
			let last = NaN;
			let outputs;

			this.#renderFunc = (now) => {
				if (config.once) {
					this.stop();
				}

				if (isNaN(start)) {
					start = now;
				}

				if (isNaN(last)) {
					last = start;
				}

				const shouldRender =
					config.fps >= 60 || now - last >= targetFrameTimeMilliseconds || config.once;
				if (shouldRender) {
					while (now - targetFrameTimeMilliseconds > last) {
						last += targetFrameTimeMilliseconds;
					}
				}

				const size = this.size;
				const [width, height] = size;
				if (outputs == null || dimensions.width !== width || dimensions.height !== height) {
					[dimensions.width, dimensions.height] = size;
					outputs = pipeline.build(size);
				}

				if (config.useCamera) {
					device.queue.copyExternalImageToTexture(
						{ source: cameraCanvas },
						{ texture: cameraTex },
						cameraSize,
					);
				}

				device.queue.writeBuffer(
					timeBuffer,
					0,
					timeUniforms.toBuffer({ seconds: (now - start) / 1000, frames }),
				);
				frames++;

				const encoder = device.createCommandEncoder();
				pipeline.run(encoder, shouldRender);
				// Eventually, when WebGPU allows it, we'll remove the endPass and just copy from our pipeline's output to the canvas texture.
				// encoder.copyTextureToTexture({ texture: outputs?.primary }, { texture: canvasContext.getCurrentTexture() }, canvasSize);
				device.queue.submit([encoder.finish()]);
			};
		})();
		await this.#rebuildingPipeline;
		this.#renderFunc(performance.now());
		if (oldDevice != null) {
			await oldDevice.queue.onSubmittedWorkDone();
			oldDevice.destroy();
		}
	}

	stop() {
		super.stop();
		this.#renderFunc = null;
	}

	update(now) {
		if (this.#renderFunc != null) {
			this.#renderFunc(now);
		}
		super.update(now);
	}

	destroy() {
		if (this.destroyed) return;
		const oldDevice = this.#device;
		if (oldDevice != null) {
			async () => {
				await oldDevice.queue.onSubmittedWorkDone();
				oldDevice.destroy();
			};
		}
		this.#device = null;
		super.destroy();
	}
}
