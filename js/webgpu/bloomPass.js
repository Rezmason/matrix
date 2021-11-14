import { structs } from "/lib/gpu-buffer.js";
import { makeComputeTarget, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

export default (context, getInputs) => {
	const { config, device } = context;

	const bloomSize = config.bloomSize;
	const bloomStrength = config.newBloomStrength;

	const enabled = bloomSize > 0 && bloomStrength > 0;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeComputeTarget(device, 1, 1);
		const getOutputs = () => ({ ...getInputs(), bloom: emptyTexture });
		return makePass(getOutputs);
	}

	const assets = [loadShader(device, "shaders/wgsl/blur1D.wgsl")];

	const nearestSampler = device.createSampler({});

	let computePipeline;
	let configUniforms;
	let horizontalConfigBuffer;
	let verticalConfigBuffer;
	let intermediate;
	let output;
	let screenSize;

	const getOutputs = () => ({
		primary: getInputs().primary,
		bloom: output,
	});

	const ready = (async () => {
		const [blurShader] = await Promise.all(assets);

		computePipeline = device.createComputePipeline({
			compute: {
				module: blurShader.module,
				entryPoint: "computeMain",
			},
		});

		configUniforms = structs.from(blurShader.code).Config;
	})();

	const setSize = (width, height) => {
		intermediate?.destroy();
		intermediate = makeComputeTarget(device, Math.floor(width * bloomSize), height);
		output?.destroy();
		output = makeComputeTarget(device, Math.floor(width * bloomSize), Math.floor(height * bloomSize));
		screenSize = [width, height];

		horizontalConfigBuffer = makeUniformBuffer(device, configUniforms, { bloomStrength, direction: [0, bloomSize] });
		verticalConfigBuffer = makeUniformBuffer(device, configUniforms, { bloomStrength, direction: [1, 0] });
	};

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const intermediateView = intermediate.createView();
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, makeBindGroup(device, computePipeline, 0, [horizontalConfigBuffer, nearestSampler, tex.createView(), intermediateView]));
		computePass.dispatch(Math.ceil(Math.floor(screenSize[0] * bloomSize) / 32), screenSize[1], 1);
		computePass.setBindGroup(0, makeBindGroup(device, computePipeline, 0, [verticalConfigBuffer, nearestSampler, intermediateView, output.createView()]));
		computePass.dispatch(Math.ceil(Math.floor(screenSize[0] * bloomSize) / 32), Math.floor(screenSize[1] * bloomSize), 1);
		computePass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
