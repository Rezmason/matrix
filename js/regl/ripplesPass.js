import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";

const start = Date.now();
const numClicks = 5;
const clicks = Array(numClicks).fill([0, 0, -Infinity]).flat();
let aspectRatio = 1;

let index = 0;
window.onclick = (e) => {
	clicks[index * 3 + 0] = 0 + e.clientX / e.srcElement.clientWidth;
	clicks[index * 3 + 1] = 1 - e.clientY / e.srcElement.clientHeight;
	clicks[index * 3 + 2] = (Date.now() - start) / 1000;
	index = (index + 1) % numClicks;
}

export default ({ regl, config }, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const ripplesPassFrag = loadText("shaders/glsl/ripplesPass.frag.glsl");
	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			time: regl.context("time"),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			clicks: () => clicks,
			aspectRatio: () => aspectRatio
		},
		framebuffer: output,
	});
	return makePass(
		{
			primary: output,
		},
		Promise.all([ripplesPassFrag.loaded]),
		(w, h) => {
			output.resize(w, h);
			aspectRatio = w / h;
		},
		() => render({ frag: ripplesPassFrag.text() })
	);
};
