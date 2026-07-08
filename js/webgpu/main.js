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
import { setupFullscreenToggle } from "../fullscreen.js";
import { createEffectsMapping, getEffectPass } from "../effects.js";

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

export default async (canvas, config) => {
	await loadJS("lib/gl-matrix.js");

	// Setup fullscreen toggle with proper cleanup
	const cleanupFullscreen = setupFullscreenToggle(canvas);

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
		canvas,
		canvasContext,
		timeBuffer,
		canvasFormat,
		cameraTex,
		cameraAspectRatio,
		cameraSize,
	};

	// Create dynamic effects mapping
	const passModules = {
		makePalettePass,
		makeStripePass,
		makeImagePass,
		makeMirrorPass,
	};
	const effects = createEffectsMapping("webgpu", passModules);
	const effectPass = getEffectPass(config.effect, effects, "palette");
	const pipeline = await makePipeline(context, [makeRain, makeBloomPass, effectPass, makeEndPass]);

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

		const shouldRender = config.fps >= 60 || now - last >= targetFrameTimeMilliseconds || config.once;
		if (shouldRender) {
			while (now - targetFrameTimeMilliseconds > last) {
				last += targetFrameTimeMilliseconds;
			}
		}

		const devicePixelRatio = window.devicePixelRatio ?? 1;
		const canvasWidth = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		const canvasHeight = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
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
		pipeline.run(encoder, shouldRender);
		// Eventually, when WebGPU allows it, we'll remove the endPass and just copy from our pipeline's output to the canvas texture.
		// encoder.copyTextureToTexture({ texture: outputs?.primary }, { texture: canvasContext.getCurrentTexture() }, canvasSize);
		device.queue.submit([encoder.finish()]);

		if (!config.once) {
			requestAnimationFrame(renderLoop);
		}
	};

	requestAnimationFrame(renderLoop);
};

// Rebuild pipeline on fullscreen/resize when canvas visual size changes
const recalcOutputs = () => {
	const devicePixelRatio = window.devicePixelRatio ?? 1;
	const canvasWidth = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
	const canvasHeight = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
	const canvasSize = [canvasWidth, canvasHeight];
	if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;
		outputs = pipeline.build(canvasSize);
	}
};

const recalcFullscreenChange = () => {
	recalcOutputs();
	if (config.useCamera) {
		device.queue.copyExternalImageToTexture({ source: cameraCanvas }, { texture: cameraTex }, cameraSize);
	}
};

const recalcResize = () => {
	recalcOutputs();
};

document.addEventListener("fullscreenchange", recalcFullscreenChange);
document.addEventListener("webkitfullscreenchange", recalcFullscreenChange);
document.addEventListener("mozfullscreenchange", recalcFullscreenChange);
document.addEventListener("MSFullscreenChange", recalcFullscreenChange);
window.addEventListener("resize", recalcResize);
