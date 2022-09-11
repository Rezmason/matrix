import { structs } from "../../lib/gpu-buffer.js";
import { makeComputeTarget, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

// const makePyramid = makeComputeTarget;

// const destroyPyramid = (pyramid) => pyramid?.destroy();

// const makePyramidLevelView = (pyramid, level) =>
// 	pyramid.createView({
// 		baseMipLevel: level,
// 		mipLevelCount: 1,
// 		dimension: "2d",
// 	});

// const makePyramidViews = (pyramid) => [pyramid.createView()];

const makePyramid = (device, size, pyramidHeight) =>
	Array(pyramidHeight)
		.fill()
		.map((_, index) =>
			makeComputeTarget(
				device,
				size.map((x) => Math.floor(x * 2 ** -(index + 1)))
			)
		);

const destroyPyramid = (pyramid) => pyramid?.forEach((texture) => texture.destroy());

const makePyramidLevelView = (pyramid, level) => pyramid[level].createView();

const makePyramidViews = (pyramid) => pyramid.map((tex) => tex.createView());

// The bloom pass is basically an added blur of the rain pass's high-pass output.
// The blur approximation is the sum of a pyramid of downscaled, blurred textures.

export default ({ config, device }) => {
	const pyramidHeight = 4;
	const bloomSize = config.bloomSize;
	const bloomStrength = config.bloomStrength;
	const bloomRadius = 2; // Looks better with more, but is more costly

	const enabled = bloomSize > 0 && bloomStrength > 0;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeComputeTarget(device, [1, 1]);
		return makePass("No Bloom", null, (size, inputs) => ({ ...inputs, bloom: emptyTexture }));
	}

	const assets = [loadShader(device, "shaders/wgsl/bloomBlur.wgsl"), loadShader(device, "shaders/wgsl/bloomCombine.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	// The blur pipeline applies a blur in one direction; it's applied horizontally
	// to the first image pyramid, and then vertically to the second image pyramid.
	let blurPipeline;
	let hBlurPyramid;
	let vBlurPyramid;
	let hBlurBuffer;
	let vBlurBuffer;
	let hBlurBindGroups;
	let vBlurBindGroups;

	// The combine pipeline blends the last image pyramid's layers into the output.
	let combinePipeline;
	let combineBuffer;
	let combineBindGroup;
	let output;
	let scaledScreenSize;

	const loaded = (async () => {
		const [blurShader, combineShader] = await Promise.all(assets);

		[blurPipeline, combinePipeline] = await Promise.all([
			device.createComputePipeline({
				layout: "auto",
				compute: {
					module: blurShader.module,
					entryPoint: "computeMain",
				},
			}),

			device.createComputePipeline({
				layout: "auto",
				compute: {
					module: combineShader.module,
					entryPoint: "computeMain",
				},
			}),
		]);

		const blurUniforms = structs.from(blurShader.code).Config;
		hBlurBuffer = makeUniformBuffer(device, blurUniforms, { bloomRadius, direction: [1, 0] });
		vBlurBuffer = makeUniformBuffer(device, blurUniforms, { bloomRadius, direction: [0, 1] });

		const combineUniforms = structs.from(combineShader.code).Config;
		combineBuffer = makeUniformBuffer(device, combineUniforms, { pyramidHeight });
	})();

	const build = (screenSize, inputs) => {
		// Since the bloom is blurry, we downscale everything
		scaledScreenSize = screenSize.map((x) => Math.floor(x * bloomSize));

		destroyPyramid(hBlurPyramid);
		hBlurPyramid = makePyramid(device, scaledScreenSize, pyramidHeight);

		destroyPyramid(vBlurPyramid);
		vBlurPyramid = makePyramid(device, scaledScreenSize, pyramidHeight);

		output?.destroy();
		output = makeComputeTarget(device, scaledScreenSize);

		hBlurBindGroups = [];
		vBlurBindGroups = [];

		// The first pyramid's level 1 texture is the input texture blurred.
		// The subsequent levels of the pyramid are the preceding level blurred.
		let srcView = inputs.highPass.createView();
		for (let i = 0; i < pyramidHeight; i++) {
			const hBlurPyramidView = makePyramidLevelView(hBlurPyramid, i);
			const vBlurPyramidView = makePyramidLevelView(vBlurPyramid, i);
			hBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [hBlurBuffer, linearSampler, srcView, hBlurPyramidView]);
			vBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [vBlurBuffer, linearSampler, hBlurPyramidView, vBlurPyramidView]);
			srcView = hBlurPyramidView;
		}

		combineBindGroup = makeBindGroup(device, combinePipeline, 0, [combineBuffer, linearSampler, ...makePyramidViews(vBlurPyramid), output.createView()]);

		return {
			...inputs,
			bloom: output,
		};
	};

	const run = (encoder) => {
		const computePass = encoder.beginComputePass();

		computePass.setPipeline(blurPipeline);
		for (let i = 0; i < pyramidHeight; i++) {
			const dispatchSize = [Math.ceil(Math.floor(scaledScreenSize[0] * 2 ** -i) / 32), Math.floor(Math.floor(scaledScreenSize[1] * 2 ** -i)), 1];
			computePass.setBindGroup(0, hBlurBindGroups[i]);
			computePass.dispatchWorkgroups(...dispatchSize);
			computePass.setBindGroup(0, vBlurBindGroups[i]);
			computePass.dispatchWorkgroups(...dispatchSize);
		}

		computePass.setPipeline(combinePipeline);
		computePass.setBindGroup(0, combineBindGroup);
		computePass.dispatchWorkgroups(Math.ceil(scaledScreenSize[0] / 32), scaledScreenSize[1], 1);

		computePass.end();
	};

	return makePass("Bloom", loaded, build, run);
};
