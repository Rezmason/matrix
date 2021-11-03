import std140 from "./std140.js";
import { getCanvasSize, loadTexture, loadShaderModule, makeUniformBuffer } from "./utils.js";
const { mat4, vec3 } = glMatrix;

const rippleTypes = {
	box: 0,
	circle: 1,
};

const cycleStyles = {
	cycleFasterWhenDimmed: 0,
	cycleRandomly: 1,
};

const numVerticesPerQuad = 2 * 3;

export default async (canvas, config) => {
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");
	const presentationFormat = canvasContext.getPreferredFormat(adapter);

	console.table(device.limits);

	const canvasConfig = {
		device,
		format: presentationFormat,
		size: getCanvasSize(canvas),
	};

	canvasContext.configure(canvasConfig);

	const assets = [
		loadTexture(device, config.glyphTexURL),
		loadShaderModule(device, "shaders/wgsl/rainPass.wgsl"),
		loadShaderModule(device, "shaders/wgsl/renderToCanvas.wgsl"),
	];

	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const volumetric = config.volumetric;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const gridSize = [config.numColumns * density, config.numColumns];
	const numCells = gridSize[0] * gridSize[1];

	// The volumetric mode requires us to create a grid of quads,
	// rather than a single quad for our geometry
	const numQuads = volumetric ? numCells : 1;

	// Various effect-related values
	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const cycleStyle = config.cycleStyleName in cycleStyles ? cycleStyles[config.cycleStyleName] : 0;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showComputationTexture = config.effect === "none";

	const configData = [
		// common
		{ name: "animationSpeed", type: "f32", value: config.animationSpeed },
		{ name: "glyphSequenceLength", type: "i32", value: config.glyphSequenceLength },
		{ name: "glyphTextureColumns", type: "i32", value: config.glyphTextureColumns },
		{ name: "glyphHeightToWidth", type: "f32", value: config.glyphHeightToWidth },
		{ name: "resurrectingCodeRatio", type: "f32", value: config.resurrectingCodeRatio },
		{ name: "gridSize", type: "vec2<f32>", value: gridSize },
		{ name: "showComputationTexture", type: "i32", value: showComputationTexture },

		// compute
		{ name: "brightnessThreshold", type: "f32", value: config.brightnessThreshold },
		{ name: "brightnessOverride", type: "f32", value: config.brightnessOverride },
		{ name: "brightnessDecay", type: "f32", value: config.brightnessDecay },
		{ name: "cursorEffectThreshold", type: "f32", value: config.cursorEffectThreshold },
		{ name: "cycleSpeed", type: "f32", value: config.cycleSpeed },
		{ name: "cycleFrameSkip", type: "i32", value: config.cycleFrameSkip },
		{ name: "fallSpeed", type: "f32", value: config.fallSpeed },
		{ name: "hasSun", type: "i32", value: config.hasSun },
		{ name: "hasThunder", type: "i32", value: config.hasThunder },
		{ name: "raindropLength", type: "f32", value: config.raindropLength },
		{ name: "rippleScale", type: "f32", value: config.rippleScale },
		{ name: "rippleSpeed", type: "f32", value: config.rippleSpeed },
		{ name: "rippleThickness", type: "f32", value: config.rippleThickness },
		{ name: "cycleStyle", type: "i32", value: cycleStyle },
		{ name: "rippleType", type: "i32", value: rippleType },

		// render
		{ name: "forwardSpeed", type: "f32", value: config.forwardSpeed },
		{ name: "glyphVerticalSpacing", type: "f32", value: config.glyphVerticalSpacing },
		{ name: "glyphEdgeCrop", type: "f32", value: config.glyphEdgeCrop },
		{ name: "isPolar", type: "i32", value: config.isPolar },
		{ name: "density", type: "f32", value: density },
		{ name: "slantScale", type: "f32", value: slantScale },
		{ name: "slantVec", type: "vec2<f32>", value: slantVec },
		{ name: "volumetric", type: "i32", value: volumetric },
	];
	console.table(configData);

	const configLayout = std140(configData.map((field) => field.type));
	const configBuffer = makeUniformBuffer(
		device,
		configLayout,
		configData.map((field) => field.value)
	);

	const timeLayout = std140(["f32", "i32"]);
	const timeBuffer = makeUniformBuffer(device, timeLayout);

	const sceneLayout = std140(["vec2<f32>", "mat4x4<f32>", "mat4x4<f32>"]);
	const sceneBuffer = makeUniformBuffer(device, sceneLayout);

	const cellsBuffer = device.createBuffer({
		size: numCells * std140(["vec4<f32>"]).size,
		usage: GPUBufferUsage.STORAGE,
	});

	const transform = mat4.create();
	mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
	const camera = mat4.create();

	const updateCameraBuffer = () => {
		const canvasSize = canvasConfig.size;
		const aspectRatio = canvasSize[0] / canvasSize[1];
		mat4.perspectiveZO(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		device.queue.writeBuffer(sceneBuffer, 0, sceneLayout.build([screenSize, camera, transform]));
	};
	updateCameraBuffer();

	const msdfSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	const [msdfTexture, rainShaderModule, renderToCanvasShaderModule] = await Promise.all(assets);

	const rainComputePipeline = device.createComputePipeline({
		compute: {
			module: rainShaderModule,
			entryPoint: "computeMain",
		},
	});

	const additiveBlendComponent = {
		operation: "add",
		srcFactor: "one",
		dstFactor: "one",
	};

	const rainRenderPipeline = device.createRenderPipeline({
		vertex: {
			module: rainShaderModule,
			entryPoint: "vertMain",
		},
		fragment: {
			module: rainShaderModule,
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

	const renderToCanvasPipeline = device.createRenderPipeline({
		vertex: {
			module: renderToCanvasShaderModule,
			entryPoint: "vertMain",
		},
		fragment: {
			module: renderToCanvasShaderModule,
			entryPoint: "fragMain",
			targets: [
				{
					format: presentationFormat,
				},
			],
		},
	});

	const rainComputeBindGroup = device.createBindGroup({
		layout: rainComputePipeline.getBindGroupLayout(0),
		entries: [configBuffer, timeBuffer, cellsBuffer]
			.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
			.map((resource, binding) => ({
				binding,
				resource,
			})),
	});

	const rainRenderBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(0),
		entries: [configBuffer, timeBuffer, sceneBuffer, msdfSampler, msdfTexture.createView(), cellsBuffer]
			.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
			.map((resource, binding) => ({
				binding,
				resource,
			})),
	});

	const renderToCanvasBindGroup = device.createBindGroup({
		layout: renderToCanvasPipeline.getBindGroupLayout(0),
		entries: [msdfSampler, msdfTexture.createView()]
			.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
			.map((resource, binding) => ({
				binding,
				resource,
			})),
	});

	const rainRenderPassConfig = {
		colorAttachments: [
			{
				view: canvasContext.getCurrentTexture().createView(),
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	const renderToCanvasPassConfig = {
		colorAttachments: [
			{
				view: canvasContext.getCurrentTexture().createView(),
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	let frame = 0;

	const renderLoop = (now) => {
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);

			// TODO: destroy and recreate all screen size textures

			updateCameraBuffer();
		}

		device.queue.writeBuffer(timeBuffer, 0, timeLayout.build([now / 1000, frame]));
		frame++;

		const encoder = device.createCommandEncoder();

		const rainComputePass = encoder.beginComputePass();
		rainComputePass.setPipeline(rainComputePipeline);
		rainComputePass.setBindGroup(0, rainComputeBindGroup);
		rainComputePass.dispatch(Math.ceil(gridSize[0] / 32), gridSize[1], 1);
		rainComputePass.endPass();

		rainRenderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();
		const rainRenderPass = encoder.beginRenderPass(rainRenderPassConfig);
		rainRenderPass.setPipeline(rainRenderPipeline);
		rainRenderPass.setBindGroup(0, rainRenderBindGroup);
		rainRenderPass.draw(numVerticesPerQuad * numQuads, 1, 0, 0);
		rainRenderPass.endPass();

		// renderToCanvasPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();
		// const renderToCanvasPass = encoder.beginRenderPass(renderToCanvasPassConfig);
		// renderToCanvasPass.setPipeline(renderToCanvasPipeline);
		// renderToCanvasPass.setBindGroup(0, renderToCanvasBindGroup);
		// renderToCanvasPass.draw(numVerticesPerQuad, 1, 0, 0);
		// renderToCanvasPass.endPass();

		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);

		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
