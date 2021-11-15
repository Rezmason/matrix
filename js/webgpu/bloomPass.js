import { structs } from "/lib/gpu-buffer.js";
import { makeComputeTarget, makePyramidView, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

export default (context, getInputs) => {
	const { config, device } = context;

	const pyramidHeight = 4;
	const bloomSize = config.bloomSize;
	const bloomStrength = config.bloomStrength;
	const bloomRadius = 2; // Looks better with more, but is more costly

	const enabled = true;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeComputeTarget(device, 1, 1);
		const getOutputs = () => ({ ...getInputs(), bloom: emptyTexture });
		return makePass(getOutputs);
	}

	const assets = [loadShader(device, "shaders/wgsl/bloomBlur.wgsl"), loadShader(device, "shaders/wgsl/bloomCombine.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let blurPipeline;
	let combinePipeline;
	let hBlurPyramid;
	let vBlurPyramid;
	let hBlurBuffer;
	let vBlurBuffer;
	let combineBuffer;
	let output;
	let scaledScreenSize;

	const getOutputs = () => ({
		primary: getInputs().primary,
		bloom: output,
	});

	const ready = (async () => {
		const [blurShader, combineShader] = await Promise.all(assets);

		blurPipeline = device.createComputePipeline({
			compute: {
				module: blurShader.module,
				entryPoint: "computeMain",
			},
		});

		combinePipeline = device.createComputePipeline({
			compute: {
				module: combineShader.module,
				entryPoint: "computeMain",
			},
		});

		const blurUniforms = structs.from(blurShader.code).Config;
		hBlurBuffer = makeUniformBuffer(device, blurUniforms, { bloomRadius, direction: [1, 0] });
		vBlurBuffer = makeUniformBuffer(device, blurUniforms, { bloomRadius, direction: [0, 1] });

		const combineUniforms = structs.from(combineShader.code).Config;
		combineBuffer = makeUniformBuffer(device, combineUniforms, { bloomStrength, pyramidHeight });
	})();

	const setSize = (width, height) => {
		hBlurPyramid?.destroy();
		hBlurPyramid = makeComputeTarget(device, Math.floor(width * bloomSize), Math.floor(height * bloomSize), pyramidHeight);

		vBlurPyramid?.destroy();
		vBlurPyramid = makeComputeTarget(device, Math.floor(width * bloomSize), Math.floor(height * bloomSize), pyramidHeight);

		output?.destroy();
		output = makeComputeTarget(device, Math.floor(width * bloomSize), Math.floor(height * bloomSize));
		scaledScreenSize = [Math.floor(width * bloomSize), Math.floor(height * bloomSize)];
	};

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;

		const computePass = encoder.beginComputePass();

		computePass.setPipeline(blurPipeline);
		const hBlurPyramidViews = Array(pyramidHeight)
			.fill()
			.map((_, level) => makePyramidView(hBlurPyramid, level));
		const vBlurPyramidViews = Array(pyramidHeight)
			.fill()
			.map((_, level) => makePyramidView(vBlurPyramid, level));
		for (let i = 0; i < pyramidHeight; i++) {
			const downsample = 2 ** -i;
			const size = [Math.ceil(Math.floor(scaledScreenSize[0] * downsample) / 32), Math.floor(Math.floor(scaledScreenSize[1] * downsample)), 1];
			const srcView = i === 0 ? tex.createView() : hBlurPyramidViews[i - 1];
			computePass.setBindGroup(0, makeBindGroup(device, blurPipeline, 0, [hBlurBuffer, linearSampler, srcView, hBlurPyramidViews[i]]));
			computePass.dispatch(...size);
			computePass.setBindGroup(0, makeBindGroup(device, blurPipeline, 0, [vBlurBuffer, linearSampler, hBlurPyramidViews[i], vBlurPyramidViews[i]]));
			computePass.dispatch(...size);
		}

		computePass.setPipeline(combinePipeline);
		computePass.setBindGroup(0, makeBindGroup(device, combinePipeline, 0, [combineBuffer, linearSampler, vBlurPyramid.createView(), output.createView()]));
		computePass.dispatch(Math.ceil(scaledScreenSize[0] / 32), scaledScreenSize[1], 1);

		computePass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
