import { loadText, make1DTexture, makePassFBO, makePass } from "./utils.js";

export default (regl, config, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const { backgroundColor } = config;
	const resurrectionPassFrag = loadText("shaders/resurrectionPass.frag");

	const render = regl({
		frag: regl.prop("frag"),

		uniforms: {
			backgroundColor,
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			ditherMagnitude: 0.05,
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: output,
		},
		() => render({ frag: resurrectionPassFrag.text() })
	);
};
