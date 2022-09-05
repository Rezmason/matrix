import { structs } from "../../lib/gpu-buffer.js";
import { makeUniformBuffer, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeMirrorPass from "./mirrorPass.js";
import makeEndPass from "./endPass.js";
import { setupCamera, cameraCanvas, cameraAspectRatio, cameraSize } from "../camera.js";

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

const effects = {
	none: null,
	plain: makePalettePass,
	customStripes: makeStripePass,
	stripes: makeStripePass,
	pride: makeStripePass,
	transPride: makeStripePass,
	trans: makeStripePass,
	image: makeImagePass,
	mirror: makeMirrorPass,
};

export default async (canvas, config) => {
	await loadJS("lib/gl-matrix.js");

	if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
		window.ondblclick = () => {
			if (document.fullscreenElement == null) {
				if (canvas.webkitRequestFullscreen != null) {
					canvas.webkitRequestFullscreen();
				} else {
					canvas.requestFullscreen();
				}
			} else {
				document.exitFullscreen();
			}
		};
	}

	if (config.useCamera) {
		await setupCamera();
	}

	const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");

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
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

	const context = {
		config,
		adapter,
		device,
		canvasContext,
		timeBuffer,
		canvasFormat,
		cameraTex,
		cameraAspectRatio,
		cameraSize,
	};

	const effectName = config.effect in effects ? config.effect : "plain";
	const pipeline = await makePipeline(context, [makeRain, makeBloomPass, effects[effectName], makeEndPass]);

	let frames = 0;
	let start = NaN;
	let outputs;

	const renderLoop = (now) => {
		if (isNaN(start)) {
			start = now;
		}

		const devicePixelRatio = window.devicePixelRatio ?? 1;
		const canvasWidth = canvas.clientWidth * devicePixelRatio;
		const canvasHeight = canvas.clientHeight * devicePixelRatio;
		const canvasSize = [canvasWidth, canvasHeight];
		if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;
			outputs = pipeline.build(canvasSize);
		}

		if (config.useCamera) {
			device.queue.copyExternalImageToTexture({ source: cameraCanvas }, { texture: cameraTex }, cameraSize);
		}

		device.queue.writeBuffer(timeBuffer, 0, timeUniforms.toBuffer({ seconds: (now - start) / 1000, frames }));
		frames++;

		const encoder = device.createCommandEncoder();
		pipeline.run(encoder);
		// Eventually, when WebGPU allows it, we'll remove the endPass and just copy from our pipeline's output to the canvas texture.
		// encoder.copyTextureToTexture({ texture: outputs?.primary }, { texture: canvasContext.getCurrentTexture() }, canvasSize);
		device.queue.submit([encoder.finish()]);
		if (!config.once) {
			requestAnimationFrame(renderLoop);
		}
	};

	requestAnimationFrame(renderLoop);
};
