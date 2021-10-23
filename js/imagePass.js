import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/0/0a/Flammarion_Colored.jpg";

export default (regl, config, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const background = loadImage(regl, bgURL);
	const imagePassFrag = loadText("shaders/imagePass.frag.glsl");
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
		() => render({ frag: imagePassFrag.text() }),
		null,
		[background.loaded, imagePassFrag.loaded]
	);
};
