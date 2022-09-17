import { structs } from "../../lib/gpu-buffer.js";
import { makeRenderTarget, loadTexture, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

const rippleTypes = {
	box: 0,
	circle: 1,
};

const numVerticesPerQuad = 2 * 3;

const makeConfigBuffer = (device, configUniforms, config, density, gridSize) => {
	const configData = {
		...config,
		gridSize,
		density,
		showDebugView: config.effect === "none",
		rippleType: config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1,
		slantScale: 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1),
		slantVec: [Math.cos(config.slant), Math.sin(config.slant)],
	};
	// console.table(configData);

	return makeUniformBuffer(device, configUniforms, configData);
};

export default ({ config, device, timeBuffer }) => {
	const { mat4, vec3 } = glMatrix;

	const assets = [loadTexture(device, config.glyphTexURL), loadShader(device, "shaders/wgsl/rainPass.wgsl")];

	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const density = config.volumetric && config.effect !== "none" ? config.density : 1;
	const gridSize = [config.numColumns * density, config.numColumns];
	const numCells = gridSize[0] * gridSize[1];

	// The volumetric mode requires us to create a grid of quads,
	// rather than a single quad for our geometry
	const numQuads = config.volumetric ? numCells : 1;

	const transform = mat4.create();
	if (config.volumetric && config.isometric) {
		mat4.rotateX(transform, transform, (Math.PI * 1) / 8);
		mat4.rotateY(transform, transform, (Math.PI * 1) / 4);
		mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
		mat4.scale(transform, transform, vec3.fromValues(1, 1, 2));
	} else {
		mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
	}
	const camera = mat4.create();

	// TODO: vantage points, multiple renders

	// We use the different channels for different parts of the raindrop
	const renderFormat = "rgba8unorm";

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	const renderPassConfig = {
		colorAttachments: [
			{
				// view: null,
				loadOp: "clear",
				storeOp: "store",
			},
			{
				// view: null,
				loadOp: "clear",
				storeOp: "store",
			},
		],
	};

	let configBuffer;
	let sceneUniforms;
	let sceneBuffer;
	let computePipeline;
	let renderPipeline;
	let computeBindGroup;
	let renderBindGroup;
	let output;
	let highPassOutput;

	const loaded = (async () => {
		const [msdfTexture, rainShader] = await Promise.all(assets);

		const rainShaderUniforms = structs.from(rainShader.code);
		configBuffer = makeConfigBuffer(device, rainShaderUniforms.Config, config, density, gridSize);

		const cellsBuffer = device.createBuffer({
			size: numCells * rainShaderUniforms.Cell.minSize,
			usage: GPUBufferUsage.STORAGE,
		});

		sceneUniforms = rainShaderUniforms.Scene;
		sceneBuffer = makeUniformBuffer(device, sceneUniforms);

		const additiveBlendComponent = {
			operation: "add",
			srcFactor: "one",
			dstFactor: "one",
		};

		[computePipeline, renderPipeline] = await Promise.all([
			device.createComputePipelineAsync({
				layout: "auto",
				compute: {
					module: rainShader.module,
					entryPoint: "computeMain",
				},
			}),

			device.createRenderPipelineAsync({
				layout: "auto",
				vertex: {
					module: rainShader.module,
					entryPoint: "vertMain",
				},
				fragment: {
					module: rainShader.module,
					entryPoint: "fragMain",
					targets: [
						{
							format: renderFormat,
							blend: {
								color: additiveBlendComponent,
								alpha: additiveBlendComponent,
							},
						},
						{
							format: renderFormat,
							blend: {
								color: additiveBlendComponent,
								alpha: additiveBlendComponent,
							},
						},
					],
				},
			}),
		]);

		computeBindGroup = makeBindGroup(device, computePipeline, 0, [configBuffer, timeBuffer, cellsBuffer]);
		renderBindGroup = makeBindGroup(device, renderPipeline, 0, [configBuffer, timeBuffer, sceneBuffer, linearSampler, msdfTexture.createView(), cellsBuffer]);
	})();

	const build = (size) => {
		// Update scene buffer: camera and transform math for the volumetric mode
		const aspectRatio = size[0] / size[1];
		if (config.volumetric && config.isometric) {
			if (aspectRatio > 1) {
				mat4.orthoZO(camera, -1.5 * aspectRatio, 1.5 * aspectRatio, -1.5, 1.5, -1000, 1000);
			} else {
				mat4.orthoZO(camera, -1.5, 1.5, -1.5 / aspectRatio, 1.5 / aspectRatio, -1000, 1000);
			}
		} else {
			mat4.perspectiveZO(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
		}
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		device.queue.writeBuffer(sceneBuffer, 0, sceneUniforms.toBuffer({ screenSize, camera, transform }));

		// Update
		output?.destroy();
		output = makeRenderTarget(device, size, renderFormat);

		highPassOutput?.destroy();
		highPassOutput = makeRenderTarget(device, size, renderFormat);

		return {
			primary: output,
			highPass: highPassOutput,
		};
	};

	const run = (encoder) => {
		// We render the code into an Target using MSDFs: https://github.com/Chlumsky/msdfgen

		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatchWorkgroups(Math.ceil(gridSize[0] / 32), gridSize[1], 1);
		computePass.end();

		renderPassConfig.colorAttachments[0].view = output.createView();
		renderPassConfig.colorAttachments[1].view = highPassOutput.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad * numQuads, 1, 0, 0);
		renderPass.end();
	};

	return makePass("Rain", loaded, build, run);
};
