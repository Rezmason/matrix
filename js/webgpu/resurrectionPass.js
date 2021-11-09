import { structs } from "/lib/gpu-buffer.js";
import { loadShader, makeUniformBuffer, makePassFBO, makePass } from "./utils.js";

// Matrix Resurrections isn't in theaters yet,
// and this version of the effect is still a WIP.

// Criteria:
// Upward-flowing glyphs should be golden
// Downward-flowing glyphs should be tinted slightly blue on top and golden on the bottom
// Cheat a lens blur, interpolating between the texture and bloom at the edges

const numVerticesPerQuad = 2 * 3;

export default (context, getInputs) => {
	const { config, adapter, device, canvasContext, timeBuffer } = context;

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

	let renderPipeline;
	let configBuffer;
	let output;

	const assets = [loadShader(device, "shaders/wgsl/resurrectionPass.wgsl")];

	const ready = (async () => {
		const [resurrectionShader] = await Promise.all(assets);

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: resurrectionShader.module,
				entryPoint: "vertMain",
			},
			fragment: {
				module: resurrectionShader.module,
				entryPoint: "fragMain",
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
		});

		const configUniforms = structs.from(resurrectionShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { ditherMagnitude: 0.05, backgroundColor: config.backgroundColor });
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makePassFBO(device, width, height, presentationFormat);
	};

	const getOutputs = () => ({
		primary: output,
	});

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.primary; // TODO: bloom
		const renderBindGroup = makeBindGroup(device, renderPipeline, 0, [configBuffer, timeBuffer, linearSampler, tex.createView(), bloomTex.createView()]);

		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
