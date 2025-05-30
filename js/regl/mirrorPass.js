import { loadText, makePassFBO, makePass } from "./utils.js";

export default ({ regl, canvas, cache, config, cameraTex, cameraAspectRatio }, inputs) => {
	let start;
	const numClicks = 5;
	const clicks = Array(numClicks)
		.fill()
		.map((_) => [0, 0, -Infinity]);
	let aspectRatio = 1;

	let index = 0;
	canvas.onmousedown = (e) => {
		const rect = e.srcElement.getBoundingClientRect();
		clicks[index][0] = 0 + (e.clientX - rect.x) / rect.width;
		clicks[index][1] = 1 - (e.clientY - rect.y) / rect.height;
		clicks[index][2] = (performance.now() - start) / 1000;
		index = (index + 1) % numClicks;
	};

	const output = makePassFBO(regl, config.useHalfFloat);
	const mirrorPassFrag = loadText(cache, "shaders/glsl/mirrorPass.frag.glsl");
	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			time: regl.context("time"),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			cameraTex,
			// REGL bug can misinterpret array uniforms
			["clicks[0]"]: () => clicks[0],
			["clicks[1]"]: () => clicks[1],
			["clicks[2]"]: () => clicks[2],
			["clicks[3]"]: () => clicks[3],
			["clicks[4]"]: () => clicks[4],
			aspectRatio: () => aspectRatio,
			cameraAspectRatio,
		},
		framebuffer: output,
	});

	start = performance.now();

	return makePass(
		{
			primary: output,
		},
		Promise.all([mirrorPassFrag.loaded]),
		(w, h) => {
			output.resize(w, h);
			aspectRatio = w / h;
		},
		(shouldRender) => {
			if (shouldRender) {
				render({ frag: mirrorPassFrag.text() });
			}
		},
	);
};
