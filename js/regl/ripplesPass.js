import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

// const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";

export default ({ regl, config }, inputs) => {
    console.log('ripples');
    
	const output = makePassFBO(regl, config.useHalfFloat);
	// const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	// const bloomStrength = config.bloomStrength;
	// const background = loadImage(regl, bgURL);
	const ripplesPassFrag = loadText("shaders/glsl/ripplesPass.frag.glsl");
	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			// bloomStrength,
			time: regl.context("time"),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			height: regl.context("viewportWidth"),
			width: regl.context("viewportHeight"),
		},
		framebuffer: output,
	});
	return makePass(
		{
			primary: output,
		},
		Promise.all([ripplesPassFrag.loaded]),
		(w, h) => output.resize(w, h),
		() => render({ frag: ripplesPassFrag.text() })
	);
};
