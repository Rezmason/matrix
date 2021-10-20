import { loadText, extractEntries, make1DTexture, makePassFBO, makePass } from "./utils.js";

const neapolitanStripeColors = [
	[0.4, 0.15, 0.1],
	[0.4, 0.15, 0.1],
	[0.8, 0.8, 0.6],
	[0.8, 0.8, 0.6],
	[1.0, 0.7, 0.8],
	[1.0, 0.7, 0.8],
].flat();

const prideStripeColors = [
	[1, 0, 0],
	[1, 0.5, 0],
	[1, 1, 0],
	[0, 1, 0],
	[0, 0, 1],
	[0.8, 0, 1],
].flat();

export default (regl, config, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);

	const stripeColors =
		"stripeColors" in config ? config.stripeColors.split(",").map(parseFloat) : config.effect === "pride" ? prideStripeColors : neapolitanStripeColors;
	const numStripeColors = Math.floor(stripeColors.length / 3);
	const stripes = make1DTexture(
		regl,
		stripeColors.slice(0, numStripeColors * 3).map((f) => Math.floor(f * 0xff))
	);

	const stripePassFrag = loadText("../shaders/stripePass.frag");

	const render = regl({
		frag: regl.prop("frag"),

		uniforms: {
			...extractEntries(config, ["backgroundColor"]),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			stripes,
			ditherMagnitude: 0.05,
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: output,
		},
		() => render({ frag: stripePassFrag.text() }),
		null,
		stripePassFrag.loaded
	);
};
