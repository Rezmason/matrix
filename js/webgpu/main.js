import { structs } from "../../lib/gpu-buffer.js";
import { makeUniformBuffer, makePipeline } from "./utils.js";
import fetchLibraries from "../fetchLibraries.js";

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

let glMatrix;

export const init = async (canvas) => {
	const libraries = await fetchLibraries();
	glMatrix = libraries.glMatrix;

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * rain.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * rain.resolution);
	};

	const doubleClick = () => {
		if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
			return;
		}
		if (document.fullscreenElement != null) {
			document.exitFullscreen();
			return;
		}
		if (canvas.webkitRequestFullscreen != null) {
			canvas.webkitRequestFullscreen();
		} else {
			canvas.requestFullscreen();
		}
	};

	const canvasContext = canvas.getContext("webgpu");
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();

	const cache = new Map();
	const rain = {
		canvas,
		resize,
		doubleClick,
		cache,
		canvasContext,
		adapter,
		device,
		resolution: 1,
	};

	window.addEventListener("dblclick", doubleClick);
	window.addEventListener("resize", resize);
	resize();

	return rain;
};

export const formulate = async (rain, config) => {
	if (rain.destroyed) {
		throw new Error("Cannot formulate a destroyed rain instance.");
	}
	const { resize, canvas, cache, canvasContext, adapter, device } = rain;
	rain.resolution = config.resolution;
	resize();

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
		const canvasWidth = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		const canvasHeight = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
		const canvasSize = [canvasWidth, canvasHeight];
		if (outputs == null || canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
			canvas.width = canvasWidth;
			canvas.height = canvasHeight;
			outputs = pipeline.build(canvasSize);
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

	if (rain.renderLoop != null) {
		cancelAnimationFrame(rain.renderLoop);
	}

	renderLoop(performance.now());

	rain.renderLoop = renderLoop;
};

export const destroy = (rain) => {
	if (rain.destroyed) {
		return;
	}
	const { device, resize, doubleClick, cache, canvas, renderLoop } = rain;
	window.removeEventListener("resize", resize);
	window.removeEventListener("dblclick", doubleClick);
	cache.clear();
	cancelAnimationFrame(renderLoop); // stop RAF
	// TODO: destroy WebGPU resources
	device.destroy();
	rain.destroyed = true;
};

export const type = "webgpu";
