import { structs } from "/lib/gpu-buffer.js";
import { loadShader, makeUniformBuffer, makeComputeTarget, makeBindGroup, makePass } from "./utils.js";

// Matrix Resurrections isn't in theaters yet,
// and this version of the effect is still a WIP.

// Criteria:
// Upward-flowing glyphs should be golden
// Downward-flowing glyphs should be tinted slightly blue on top and golden on the bottom
// Cheat a lens blur, interpolating between the texture and bloom at the edges

const numVerticesPerQuad = 2 * 3;

export default (context, getInputs) => {
	const { config, device, timeBuffer } = context;

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let configBuffer;
	let output;
	let screenSize;

	const assets = [loadShader(device, "shaders/wgsl/resurrectionPass.wgsl")];

	const ready = (async () => {
		const [resurrectionShader] = await Promise.all(assets);

		computePipeline = device.createComputePipeline({
			compute: {
				module: resurrectionShader.module,
				entryPoint: "computeMain",
			},
		});

		const configUniforms = structs.from(resurrectionShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { ditherMagnitude: 0.05, backgroundColor: config.backgroundColor });
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makeComputeTarget(device, width, height);
		screenSize = [width, height];
	};

	const getOutputs = () => ({
		primary: output,
	});

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.bloom;
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		const computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			configBuffer,
			timeBuffer,
			linearSampler,
			tex.createView(),
			bloomTex.createView(),
			output.createView(),
		]);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
