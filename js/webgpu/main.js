import std140 from "./std140.js";
import { getCanvasSize, loadTexture, makeUniformBuffer } from "./utils.js";
const { mat4, vec3 } = glMatrix;

export default async (canvas, config) => {
	console.log(config);

	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");
	const presentationFormat = canvasContext.getPreferredFormat(adapter);
	const queue = device.queue;

	const canvasConfig = {
		device,
		format: presentationFormat,
		size: getCanvasSize(canvas),
	};

	canvasContext.configure(canvasConfig);

	const renderPassConfig = {
		colorAttachments: [
			{
				view: canvasContext.getCurrentTexture().createView(),
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	const NUM_VERTICES_PER_QUAD = 6;

	const numColumns = config.numColumns;
	const numRows = config.numColumns;

	const msdfSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	const msdfTexture = await loadTexture(device, config.glyphTexURL);

	const configStructLayout = std140(["i32", "i32", "f32"]);
	const configBuffer = makeUniformBuffer(device, configStructLayout, [numColumns, numRows, config.glyphHeightToWidth]);

	const msdfStructLayout = std140(["i32", "i32"]);
	const msdfBuffer = makeUniformBuffer(device, msdfStructLayout, [config.glyphTextureColumns, config.glyphSequenceLength]);

	const timeStructLayout = std140(["f32", "i32"]);
	const timeBuffer = makeUniformBuffer(device, timeStructLayout);

	const sceneStructLayout = std140(["vec2<f32>", "mat4x4<f32>", "mat4x4<f32>"]);
	const sceneBuffer = makeUniformBuffer(device, sceneStructLayout);

	const transform = mat4.create();
	mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
	const camera = mat4.create();

	const updateCameraBuffer = () => {
		const canvasSize = canvasConfig.size;
		const aspectRatio = canvasSize[0] / canvasSize[1];
		mat4.perspectiveZO(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		queue.writeBuffer(sceneBuffer, 0, sceneStructLayout.build([screenSize, camera, transform]));
	};
	updateCameraBuffer();

	const [rainRenderShader] = await Promise.all(["shaders/wgsl/rainRenderPass.wgsl"].map(async (path) => (await fetch(path)).text()));

	const rainRenderShaderModule = device.createShaderModule({ code: rainRenderShader });

	const additiveBlendComponent = {
		operation: "add",
		srcFactor: "one",
		dstFactor: "one",
	};

	const rainRenderPipeline = device.createRenderPipeline({
		vertex: {
			module: rainRenderShaderModule,
			entryPoint: "vertMain",
		},
		fragment: {
			module: rainRenderShaderModule,
			entryPoint: "fragMain",
			targets: [
				{
					format: presentationFormat,
					blend: {
						color: additiveBlendComponent,
						alpha: additiveBlendComponent,
					},
				},
			],
		},
	});

	console.log(device.limits);

	const bindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(0),
		entries: [configBuffer, msdfBuffer, msdfSampler, msdfTexture.createView(), timeBuffer, sceneBuffer]
			.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
			.map((resource, binding) => ({
				binding,
				resource,
			})),
	});

	const bundleEncoder = device.createRenderBundleEncoder({
		colorFormats: [presentationFormat],
	});

	bundleEncoder.setPipeline(rainRenderPipeline);
	bundleEncoder.setBindGroup(0, bindGroup);
	const numQuads = numColumns * numRows;
	bundleEncoder.draw(NUM_VERTICES_PER_QUAD * numQuads, 1, 0, 0);
	const renderBundles = [bundleEncoder.finish()];

	let frame = 0;

	const renderLoop = (now) => {
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);

			// TODO: destroy and recreate all screen size textures

			updateCameraBuffer();
		}

		queue.writeBuffer(timeBuffer, 0, timeStructLayout.build([now / 1000, frame]));
		frame++;

		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.executeBundles(renderBundles);
		renderPass.endPass();
		const commandBuffer = encoder.finish();
		queue.submit([commandBuffer]);

		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
