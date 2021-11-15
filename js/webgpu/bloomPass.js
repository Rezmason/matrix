import { structs } from "/lib/gpu-buffer.js";
import { makeComputeTarget, makePyramidView, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

export default (context) => {
	const { config, device } = context;

	const pyramidHeight = 4;
	const bloomSize = config.bloomSize;
	const bloomStrength = config.bloomStrength;
	const bloomRadius = 2; // Looks better with more, but is more costly

	const enabled = true;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeComputeTarget(device, 1, 1);
		return makePass(null, (size, inputs) => ({ ...inputs, bloom: emptyTexture }));
	}

	const assets = [loadShader(device, "shaders/wgsl/bloomBlur.wgsl"), loadShader(device, "shaders/wgsl/bloomCombine.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let blurPipeline;
	let hBlurPyramid;
	let vBlurPyramid;
	let hBlurBuffer;
	let vBlurBuffer;
	let hBlurBindGroups;
	let vBlurBindGroups;
	let combinePipeline;
	let combineBuffer;
	let combineBindGroup;
	let output;
	let scaledScreenSize;

	const loaded = (async () => {
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

	const build = (screenSize, inputs) => {
		scaledScreenSize = screenSize.map((x) => Math.floor(x * bloomSize));

		hBlurPyramid?.destroy();
		hBlurPyramid = makeComputeTarget(device, scaledScreenSize, pyramidHeight);

		vBlurPyramid?.destroy();
		vBlurPyramid = makeComputeTarget(device, scaledScreenSize, pyramidHeight);

		output?.destroy();
		output = makeComputeTarget(device, scaledScreenSize);

		const hBlurPyramidViews = [];
		const vBlurPyramidViews = [];
		hBlurBindGroups = [];
		vBlurBindGroups = [];

		for (let i = 0; i < pyramidHeight; i++) {
			hBlurPyramidViews[i] = makePyramidView(hBlurPyramid, i);
			vBlurPyramidViews[i] = makePyramidView(vBlurPyramid, i);
			const srcView = i === 0 ? inputs.highPass.createView() : hBlurPyramidViews[i - 1];
			hBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [hBlurBuffer, linearSampler, srcView, hBlurPyramidViews[i]]);
			vBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [vBlurBuffer, linearSampler, hBlurPyramidViews[i], vBlurPyramidViews[i]]);
		}

		combineBindGroup = makeBindGroup(device, combinePipeline, 0, [combineBuffer, linearSampler, vBlurPyramid.createView(), output.createView()]);

		return {
			...inputs,
			bloom: output,
		};
	};

	const run = (encoder) => {
		const computePass = encoder.beginComputePass();

		computePass.setPipeline(blurPipeline);
		for (let i = 0; i < pyramidHeight; i++) {
			const downsample = 2 ** -i;
			const dispatchSize = [Math.ceil(Math.floor(scaledScreenSize[0] * downsample) / 32), Math.floor(Math.floor(scaledScreenSize[1] * downsample)), 1];
			computePass.setBindGroup(0, hBlurBindGroups[i]);
			computePass.dispatch(...dispatchSize);
			computePass.setBindGroup(0, vBlurBindGroups[i]);
			computePass.dispatch(...dispatchSize);
		}

		computePass.setPipeline(combinePipeline);
		computePass.setBindGroup(0, combineBindGroup);
		computePass.dispatch(Math.ceil(scaledScreenSize[0] / 32), scaledScreenSize[1], 1);

		computePass.endPass();
	};

	return makePass(loaded, build, run);
};
