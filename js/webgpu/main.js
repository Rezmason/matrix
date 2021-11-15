import { structs } from "../../lib/gpu-buffer.js";
import { getCanvasSize, makeUniformBuffer, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeResurrectionPass from "./resurrectionPass.js";
import makeEndPass from "./endPass.js";

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
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");
	const canvasFormat = canvasContext.getPreferredFormat(adapter);

	// console.table(device.limits);

	const canvasConfig = {
		device,
		format: canvasFormat,
		size: [NaN, NaN],
		usage:
			// GPUTextureUsage.STORAGE_BINDING |
			GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
	};

	const timeUniforms = structs.from(`[[block]] struct Time { seconds : f32; frames : i32; };`).Time;
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
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, effects[effectName], makeEndPass]);

	await Promise.all(pipeline.map((step) => step.loaded));

	let frames = 0;
	let start = NaN;

	const renderLoop = (now) => {
		if (isNaN(start)) {
			start = now;
		}
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);
			pipeline.reduce((outputs, step) => step.build(canvasSize, outputs), null);
		}

		device.queue.writeBuffer(timeBuffer, 0, timeUniforms.toBuffer({ seconds: (now - start) / 1000, frames }));
		frames++;

		const encoder = device.createCommandEncoder();
		pipeline.forEach((step) => step.run(encoder));
		// Eventually, when WebGPU allows it, we'll remove the endPass and just copy from our pipeline's output to the canvas texture.
		// encoder.copyTextureToTexture({ texture: pipeline[pipeline.length - 1].getOutputs().primary }, { texture: canvasContext.getCurrentTexture() }, canvasSize);
		device.queue.submit([encoder.finish()]);
		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
