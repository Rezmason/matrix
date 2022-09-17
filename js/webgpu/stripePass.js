import { structs } from "../../lib/gpu-buffer.js";
import { loadShader, make1DTexture, makeUniformBuffer, makeBindGroup, makeComputeTarget, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a 1D gradient texture
// generated from the passed-in color sequence

// This shader introduces noise into the renders, to avoid banding

const transPrideStripeColors = [
	[0.3, 1.0, 1.0],
	[0.3, 1.0, 1.0],
	[1.0, 0.5, 0.8],
	[1.0, 0.5, 0.8],
	[1.0, 1.0, 1.0],
	[1.0, 1.0, 1.0],
	[1.0, 1.0, 1.0],
	[1.0, 0.5, 0.8],
	[1.0, 0.5, 0.8],
	[0.3, 1.0, 1.0],
	[0.3, 1.0, 1.0],
].flat();

const prideStripeColors = [
	[1, 0, 0],
	[1, 0.5, 0],
	[1, 1, 0],
	[0, 1, 0],
	[0, 0, 1],
	[0.8, 0, 1],
].flat();

const numVerticesPerQuad = 2 * 3;

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default ({ config, device, timeBuffer }) => {
	// Expand and convert stripe colors into 1D texture data
	const input =
		"stripeColors" in config ? config.stripeColors.split(",").map(parseFloat) : config.effect === "pride" ? prideStripeColors : transPrideStripeColors;

	const stripeColors = Array(Math.floor(input.length / 3))
		.fill()
		.map((_, index) => [...input.slice(index * 3, (index + 1) * 3), 1]);

	const stripeTexture = make1DTexture(device, stripeColors);

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let configBuffer;
	let tex;
	let bloomTex;
	let output;
	let screenSize;

	const assets = [loadShader(device, "shaders/wgsl/stripePass.wgsl")];

	const loaded = (async () => {
		const [stripeShader] = await Promise.all(assets);

		computePipeline = await device.createComputePipelineAsync({
			layout: "auto",
			compute: {
				module: stripeShader.module,
				entryPoint: "computeMain",
			},
		});

		const configUniforms = structs.from(stripeShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, {
			bloomStrength: config.bloomStrength,
			ditherMagnitude: config.ditherMagnitude,
			backgroundColor: config.backgroundColor,
			cursorColor: config.cursorColor,
		});
	})();

	const build = (size, inputs) => {
		output?.destroy();
		output = makeComputeTarget(device, size);
		screenSize = size;

		tex = inputs.primary;
		bloomTex = inputs.bloom;

		return {
			primary: output,
		};
	};

	const run = (encoder) => {
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		const computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			configBuffer,
			timeBuffer,
			linearSampler,
			tex.createView(),
			bloomTex.createView(),
			stripeTexture.createView(),
			output.createView(),
		]);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatchWorkgroups(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.end();
	};

	return makePass("Stripe", loaded, build, run);
};
