import std140 from "./std140.js";
import { getCanvasSize, loadTexture, makeUniformBuffer } from "./utils.js";
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

	const msdfTexturePromise = loadTexture(device, config.glyphTexURL);
	const rainRenderShaderPromise = fetch("shaders/wgsl/rainRenderPass.wgsl").then((response) => response.text());

	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const volumetric = config.volumetric;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const gridSize = [config.numColumns * density, config.numColumns];

	// The volumetric mode requires us to create a grid of quads,
	// rather than a single quad for our geometry
	const numQuads = volumetric ? gridSize[0] * gridSize[1] : 1;

	// Various effect-related values
	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const cycleStyle = config.cycleStyleName in cycleStyles ? cycleStyles[config.cycleStyleName] : 0;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showComputationTexture = config.effect === "none";

	const configData = [
		// common
		{ name: "animationSpeed", type: "f32", value: config.animationSpeed },
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

	const msdfData = [
		{ name: "glyphSequenceLength", type: "i32", value: config.glyphSequenceLength },
		{ name: "glyphTextureColumns", type: "i32", value: config.glyphTextureColumns },
	];
	console.table(msdfData);

	const msdfLayout = std140(msdfData.map((field) => field.type));
	const msdfBuffer = makeUniformBuffer(
		device,
		msdfLayout,
		msdfData.map((field) => field.value)
	);

	const timeLayout = std140(["f32", "i32"]);
	const timeBuffer = makeUniformBuffer(device, timeLayout);

	const sceneLayout = std140(["vec2<f32>", "mat4x4<f32>", "mat4x4<f32>"]);
	const sceneBuffer = makeUniformBuffer(device, sceneLayout);

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

	const [msdfTexture, rainRenderShader] = await Promise.all([msdfTexturePromise, rainRenderShaderPromise]);

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
	bundleEncoder.draw(numVerticesPerQuad * numQuads, 1, 0, 0);
	const renderBundles = [bundleEncoder.finish()];

	const renderPassConfig = {
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

		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.executeBundles(renderBundles);
		renderPass.endPass();
		const commandBuffer = encoder.finish();
		device.queue.submit([commandBuffer]);

		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
