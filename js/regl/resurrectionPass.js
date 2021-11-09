import { loadText, make1DTexture, makePassFBO, makePass } from "./utils.js";

// Matrix Resurrections isn't in theaters yet,
// and this version of the effect is still a WIP.

// Criteria:
// Upward-flowing glyphs should be golden
// Downward-flowing glyphs should be tinted slightly blue on top and golden on the bottom
// Cheat a lens blur, interpolating between the texture and bloom at the edges

export default ({ regl, config }, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const { backgroundColor } = config;
	const resurrectionPassFrag = loadText("shaders/glsl/resurrectionPass.frag.glsl");

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
		resurrectionPassFrag.loaded,
		(w, h) => output.resize(w, h),
		() => render({ frag: resurrectionPassFrag.text() })
	);
};
