import { structs } from "../../lib/gpu-buffer.js";
import { makeComputeTarget, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

// The bloom pass is basically an added high-pass blur.
// The blur approximation is the sum of a pyramid of downscaled, blurred textures.

const pyramidHeight = 5;

// A pyramid is just an array of textures, where each texture is half the width
// and half the height of the texture below it.
const makePyramid = (device, size) =>
	Array(pyramidHeight)
		.fill()
		.map((_, index) =>
			makeComputeTarget(
				device,
				size.map((x) => Math.floor(x * 2 ** -index))
			)
		);

const destroyPyramid = (pyramid) => pyramid?.forEach((texture) => texture.destroy());

const dispatchSize = (texture) => [Math.ceil(texture.width / 32), texture.height, 1];

export default ({ config, device }) => {
	const { bloomStrength, bloomSize, highPassThreshold } = config;
	const enabled = bloomSize > 0 && bloomStrength > 0;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeComputeTarget(device, [1, 1]);
		return makePass("No Bloom", null, (size, inputs) => ({ ...inputs, bloom: emptyTexture }));
	}

	const assets = [
		loadShader(device, "shaders/wgsl/bloomHighPass.wgsl"),
		loadShader(device, "shaders/wgsl/bloomBlur.wgsl"),
		loadShader(device, "shaders/wgsl/bloomCombine.wgsl"),
	];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	// The high pass restricts the blur to bright things in the input texture.
	let highPassPipeline;
	let highPassBuffer;
	let highPassPyramid;
	let highPassBindGroups;

	// A 2D gaussian blur is just a 1D blur done horizontally, then done vertically.
	// The pyramid's levels represent separate levels of detail;
	// by blurring them all, this basic blur approximates a more complex gaussian:
	// https://web.archive.org/web/20191124072602/https://software.intel.com/en-us/articles/compute-shader-hdr-and-bloom
	let blurPipeline;
	let hBlurBuffer;
	let vBlurBuffer;
	let hBlurPyramid;
	let vBlurPyramid;
	let hBlurBindGroups;
	let vBlurBindGroups;

	// The pyramid of textures gets flattened (summed) into a final blurry "bloom" texture
	let combinePipeline;
	let combineBuffer;
	let combineBindGroup;
	let output;

	const loaded = (async () => {
		const [highPassShader, blurShader, combineShader] = await Promise.all(assets);

		[highPassPipeline, blurPipeline, combinePipeline] = await Promise.all(
			[highPassShader, blurShader, combineShader].map((shader) =>
				device.createComputePipelineAsync({
					layout: "auto",
					compute: {
						module: shader.module,
						entryPoint: "computeMain",
					},
				})
			)
		);

		const highPassUniforms = structs.from(highPassShader.code).Config;
		highPassBuffer = makeUniformBuffer(device, highPassUniforms, { highPassThreshold });

		const blurUniforms = structs.from(blurShader.code).Config;
		hBlurBuffer = makeUniformBuffer(device, blurUniforms, { direction: [1, 0] });
		vBlurBuffer = makeUniformBuffer(device, blurUniforms, { direction: [0, 1] });

		const combineUniforms = structs.from(combineShader.code).Config;
		combineBuffer = makeUniformBuffer(device, combineUniforms, { bloomStrength });
	})();

	const build = (screenSize, inputs) => {
		// The blur pyramids can be lower resolution than the screen.
		const scaledScreenSize = screenSize.map((x) => Math.floor(x * bloomSize));

		destroyPyramid(highPassPyramid);
		highPassPyramid = makePyramid(device, scaledScreenSize);

		destroyPyramid(hBlurPyramid);
		hBlurPyramid = makePyramid(device, scaledScreenSize);

		destroyPyramid(vBlurPyramid);
		vBlurPyramid = makePyramid(device, scaledScreenSize);

		output?.destroy();
		output = makeComputeTarget(device, screenSize);

		highPassBindGroups = [];
		hBlurBindGroups = [];
		vBlurBindGroups = [];

		// The first level's high pass reads the input texture.
		// The subsequent levels are the high pass of the preceding level.
		for (let i = 0; i < pyramidHeight; i++) {
			const highPassSource = i === 0 ? inputs.primary : highPassPyramid[i - 1];
			const highPassView = highPassPyramid[i].createView();
			const hBlurView = hBlurPyramid[i].createView();
			const vBlurView = vBlurPyramid[i].createView();
			highPassBindGroups[i] = makeBindGroup(device, highPassPipeline, 0, [highPassBuffer, linearSampler, highPassSource.createView(), highPassView]);
			hBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [hBlurBuffer, linearSampler, highPassView, hBlurView]);
			vBlurBindGroups[i] = makeBindGroup(device, blurPipeline, 0, [vBlurBuffer, linearSampler, hBlurView, vBlurView]);
		}

		combineBindGroup = makeBindGroup(device, combinePipeline, 0, [
			combineBuffer,
			linearSampler,
			...vBlurPyramid.map((texture) => texture.createView()),
			output.createView(),
		]);

		return {
			...inputs,
			bloom: output,
		};
	};

	const run = (encoder, shouldRender) => {
		if (!shouldRender) {
			return;
		}

		const computePass = encoder.beginComputePass();

		for (let i = 0; i < pyramidHeight; i++) {
			computePass.setPipeline(highPassPipeline);
			computePass.setBindGroup(0, highPassBindGroups[i]);
			computePass.dispatchWorkgroups(...dispatchSize(highPassPyramid[i]));

			computePass.setPipeline(blurPipeline);
			computePass.setBindGroup(0, hBlurBindGroups[i]);
			computePass.dispatchWorkgroups(...dispatchSize(hBlurPyramid[i]));
			computePass.setBindGroup(0, vBlurBindGroups[i]);
			computePass.dispatchWorkgroups(...dispatchSize(vBlurPyramid[i]));
		}

		computePass.setPipeline(combinePipeline);
		computePass.setBindGroup(0, combineBindGroup);
		computePass.dispatchWorkgroups(...dispatchSize(output));

		computePass.end();
	};

	return makePass("Bloom", loaded, build, run);
};
