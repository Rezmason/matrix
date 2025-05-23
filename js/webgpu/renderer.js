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
	#canvasContext;
	#adapter;
	#device;
	#renderLoop;

	constructor() {
		super("webgpu", async () => {
			const libraries = await Renderer.libraries;
			this.#glMatrix = libraries.glMatrix;
			this.#canvasContext = this.canvas.getContext("webgpu");
			this.#adapter = await navigator.gpu.requestAdapter();
			this.#device = await this.#adapter.requestDevice();
		});
	}

	async formulate(config) {
		await super.formulate(config);

		const canvas = this.canvas;
		const cache = this.cache;
		const canvasContext = this.#canvasContext;
		const adapter = this.#adapter;
		const device = this.#device;
		const glMatrix = this.#glMatrix;

		if (config.useCamera) {
			await setupCamera();
		}

		const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

		// console.table(device.limits);

		canvasContext.configure({
			device,
			format: canvasFormat,
			alphaMode: "opaque",
			usage:
				// GPUTextureUsage.STORAGE_BINDING |
				GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
		});

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
			config,
			cache,
			adapter,
			device,
			canvasContext,
			timeBuffer,
			canvasFormat,
			cameraTex,
			cameraAspectRatio,
			cameraSize,
			glMatrix,
		};

		const effectName = config.effect in effects ? config.effect : "palette";
		const pipeline = await makePipeline(context, [
			makeRain,
			makeBloomPass,
			effects[effectName],
			makeEndPass,
		]);

		const targetFrameTimeMilliseconds = 1000 / config.fps;
		let frames = 0;
		let start = NaN;
		let last = NaN;
		let outputs;

		const renderLoop = (now) => {
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

			const devicePixelRatio = window.devicePixelRatio ?? 1;
			const size = this.size;
			const [width, height] = size;
			if (outputs == null || canvas.width !== width || canvas.height !== height) {
				[canvas.width, canvas.height] = size;
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

			if (!config.once) {
				requestAnimationFrame(renderLoop);
			}
		};

		if (this.#renderLoop != null) {
			cancelAnimationFrame(this.#renderLoop);
		}

		renderLoop(performance.now());
		this.#renderLoop = renderLoop;
	}

	destroy() {
		if (this.destroyed) {
			return;
		}
		cancelAnimationFrame(this.#renderLoop); // stop RAF
		this.#device.destroy(); // This also destroys any objects created with the device
		super.destroy();
	}
}
