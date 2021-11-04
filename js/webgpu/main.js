import std140 from "./std140.js";
import { getCanvasSize, makeUniformBuffer } from "./utils.js";
import makeRain from "./rainPass.js";

export default async (canvas, config) => {
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");
	const presentationFormat = canvasContext.getPreferredFormat(adapter);

	console.table(device.limits);

	const canvasConfig = {
		device,
		format: presentationFormat,
		size: [NaN, NaN],
	};

	const timeLayout = std140(["f32", "i32"]);
	const timeBuffer = makeUniformBuffer(device, timeLayout);

	const context = {
		config,
		adapter,
		device,
		canvasContext,
		timeBuffer,
	};

	const passes = [makeRain(context)];

	await Promise.all(passes.map((pass) => pass.ready));

	let frame = 0;

	const renderLoop = (now) => {
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);
			passes.forEach((pass) => pass.setSize(...canvasSize));
		}

		device.queue.writeBuffer(timeBuffer, 0, timeLayout.build([now / 1000, frame]));
		frame++;

		const encoder = device.createCommandEncoder();
		passes.forEach((pass) => pass.execute(encoder));
		device.queue.submit([encoder.finish()]);
		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
