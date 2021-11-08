import uniforms from "/lib/gpu-uniforms.js";
import { makePassFBO, loadTexture, loadShader, makeUniformBuffer, makePass } from "./utils.js";

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

const makeConfigBuffer = (device, configUniforms, config, density, gridSize) => {
	const configData = {
		...config,
		gridSize,
		density,
		showComputationTexture: config.effect === "none",
		cycleStyle: config.cycleStyleName in cycleStyles ? cycleStyles[config.cycleStyleName] : 0,
		rippleType: config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1,
		slantScale: 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1),
		slantVec: [Math.cos(config.slant), Math.sin(config.slant)],
	};
	console.table(configData);

	return makeUniformBuffer(device, configUniforms, configData);
};

export default (context, getInputs) => {
	const { config, adapter, device, canvasContext, timeBuffer } = context;

	const assets = [loadTexture(device, config.glyphTexURL), loadShader(device, "shaders/wgsl/rainPass.wgsl")];

	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const density = config.volumetric && config.effect !== "none" ? config.density : 1;
	const gridSize = [config.numColumns * density, config.numColumns];
	const numCells = gridSize[0] * gridSize[1];

	// The volumetric mode requires us to create a grid of quads,
	// rather than a single quad for our geometry
	const numQuads = config.volumetric ? numCells : 1;

	const cellsBuffer = device.createBuffer({
		size: numCells * uniforms.byteSizeOf("vec4<f32>"),
		usage: GPUBufferUsage.STORAGE,
	});

	const transform = mat4.create();
	mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
	const camera = mat4.create();

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	const renderPassConfig = {
		colorAttachments: [
			{
				view: null,
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	const presentationFormat = canvasContext.getPreferredFormat(adapter);

	let configBuffer;
	let sceneUniforms;
	let sceneBuffer;
	let computePipeline;
	let renderPipeline;
	let computeBindGroup;
	let renderBindGroup;
	let output;

	const ready = (async () => {
		const [msdfTexture, rainShader] = await Promise.all(assets);

		const rainShaderUniforms = uniforms.read(rainShader.code);
		configBuffer = makeConfigBuffer(device, rainShaderUniforms.Config, config, density, gridSize);

		sceneUniforms = rainShaderUniforms.Scene;
		sceneBuffer = makeUniformBuffer(device, sceneUniforms);

		computePipeline = device.createComputePipeline({
			compute: {
				module: rainShader.module,
				entryPoint: "computeMain",
			},
		});

		const additiveBlendComponent = {
			operation: "add",
			srcFactor: "one",
			dstFactor: "one",
		};

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: rainShader.module,
				entryPoint: "vertMain",
			},
			fragment: {
				module: rainShader.module,
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

		computeBindGroup = device.createBindGroup({
			layout: computePipeline.getBindGroupLayout(0),
			entries: [configBuffer, timeBuffer, cellsBuffer]
				.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
				.map((resource, binding) => ({
					binding,
					resource,
				})),
		});

		renderBindGroup = device.createBindGroup({
			layout: renderPipeline.getBindGroupLayout(0),
			entries: [configBuffer, timeBuffer, sceneBuffer, linearSampler, msdfTexture.createView(), cellsBuffer]
				.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
				.map((resource, binding) => ({
					binding,
					resource,
				})),
		});
	})();

	const setSize = (width, height) => {
		// Update scene buffer: camera and transform math for the volumetric mode
		const aspectRatio = width / height;
		mat4.perspectiveZO(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		device.queue.writeBuffer(sceneBuffer, 0, sceneUniforms.write({ screenSize, camera, transform }));

		// Update
		output?.destroy();
		output = makePassFBO(device, width, height, presentationFormat);
	};

	const getOutputs = () => ({
		primary: output,
	});

	const execute = (encoder) => {
		// We render the code into an FBO using MSDFs: https://github.com/Chlumsky/msdfgen

		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(gridSize[0] / 32), gridSize[1], 1);
		computePass.endPass();

		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad * numQuads, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(ready, setSize, getOutputs, execute);
};
