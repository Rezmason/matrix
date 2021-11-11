import { structs, byteSizeOf } from "/lib/gpu-buffer.js";
import { makeComputeTarget, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

export default (context, getInputs) => {
	const { config, device, timeBuffer } = context;

	const assets = [loadShader(device, "shaders/wgsl/postProcessingPass.wgsl")];

	let configBuffer;
	let computePipeline;
	let output;
	let screenSize;

	const getOutputs = () => ({
		primary: output,
	});

	const ready = (async () => {
		const [postProcessingShader] = await Promise.all(assets);

		computePipeline = device.createComputePipeline({
			compute: {
				module: postProcessingShader.module,
				entryPoint: "computeMain",
			},
		});

		const configUniforms = structs.from(postProcessingShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, {
			/* TODO */
		});
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makeComputeTarget(device, width, height);
		screenSize = [width, height];
	};

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		const computeBindGroup = makeBindGroup(device, computePipeline, 0, [configBuffer, timeBuffer, tex.createView(), output.createView()]);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
