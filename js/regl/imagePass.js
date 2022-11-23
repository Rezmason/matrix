import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultGlyphBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";

export default ({ regl, config }, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const glyphBGURL = "glyphBGURL" in config ? config.glyphBGURL : defaultGlyphBGURL;
	const background = loadImage(regl, glyphBGURL);
	const imagePassFrag = loadText("shaders/glsl/imagePass.frag.glsl");
	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			backgroundTex: background.texture,
			tex: inputs.primary,
			bloomTex: inputs.bloom,
		},
		framebuffer: output,
	});
	return makePass(
		{
			primary: output,
		},
		Promise.all([background.loaded, imagePassFrag.loaded]),
		(w, h) => output.resize(w, h),
		(shouldRender) => {
			if (shouldRender) {
				render({ frag: imagePassFrag.text() });
			}
		}
	);
};
