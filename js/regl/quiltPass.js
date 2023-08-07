import { makePassFBO, makePass } from "./utils.js";
import quiltPassFrag from "../../shaders/glsl/quiltPass.frag.glsl";

// Multiplies the rendered rain and bloom by a loaded in image

export default ({ regl, config, lkg }, inputs) => {
	if (!lkg.enabled) {
		return makePass({
			primary: inputs.primary,
		});
	}

	const output = makePassFBO(regl, config.useHalfFloat);

	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			quiltTexture: inputs.primary,
			...lkg,
		},
		framebuffer: output,
	});
	return makePass(
		{
			primary: output,
		},
		null,
		(w, h) => output.resize(w, h),
		(shouldRender) => {
			if (shouldRender) {
				render({ frag: quiltPassFrag });
			}
		}
	);
};
