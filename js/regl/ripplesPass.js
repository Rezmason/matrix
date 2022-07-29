import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";



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
			intensity: ()=>{
				let inten = 8 - (Date.now() - window.ripples[0])/500 
				if (inten < 0) inten = 0
				return inten / 50
			},
			height: regl.context("viewportWidth"),
			width: regl.context("viewportHeight"),
			centerW: ()=> {
				return window.ripples[1]
			},
			centerH: ()=> window.ripples[2]
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
