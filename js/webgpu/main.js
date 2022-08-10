import { structs } from "../../lib/gpu-buffer.js";
import { makeUniformBuffer, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeResurrectionPass from "./resurrectionPass.js";
import makeEndPass from "./endPass.js";
import { setupCamera } from "../camera.js";

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
	resurrection: makeResurrectionPass,
	resurrections: makeResurrectionPass,
};

export default async (canvas, config) => {
	await loadJS("lib/gl-matrix.js");

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

	const context = {
		config,
		adapter,
		device,
		canvasContext,
		timeBuffer,
		canvasFormat,
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

		device.queue.writeBuffer(timeBuffer, 0, timeUniforms.toBuffer({ seconds: (now - start) / 1000, frames }));
		frames++;

		const encoder = device.createCommandEncoder();
		pipeline.run(encoder);
		// Eventually, when WebGPU allows it, we'll remove the endPass and just copy from our pipeline's output to the canvas texture.
		// encoder.copyTextureToTexture({ texture: outputs?.primary }, { texture: canvasContext.getCurrentTexture() }, canvasSize);
		device.queue.submit([encoder.finish()]);
		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
