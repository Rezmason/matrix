import { loadText, extractEntries, makePassFBO, makePyramid, resizePyramid, makePass } from "./utils.js";

// The bloom pass is basically an added high-pass blur.

const pyramidHeight = 5;
const levelStrengths = Array(pyramidHeight)
	.fill()
	.map((_, index) => Math.pow(index / (pyramidHeight * 2) + 0.5, 1 / 3).toPrecision(5))
	.reverse();

export default (regl, config, inputs) => {
	const enabled = config.bloomSize > 0 && config.bloomStrength > 0;

	if (!enabled) {
		return makePass({
			primary: inputs.primary,
			bloom: makePassFBO(regl),
		});
	}

	const uniforms = extractEntries(config, ["bloomStrength", "highPassThreshold"]);

	const highPassPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const hBlurPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const vBlurPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const output = makePassFBO(regl, config.useHalfFloat);

	const highPassFrag = loadText("../shaders/highPass.frag");

	// The high pass restricts the blur to bright things in our input texture.
	const highPass = regl({
		frag: regl.prop("frag"),
		uniforms: {
			...uniforms,
			tex: regl.prop("tex"),
		},
		framebuffer: regl.prop("fbo"),
	});

	// A 2D gaussian blur is just a 1D blur done horizontally, then done vertically.
	// The FBO pyramid's levels represent separate levels of detail;
	// by blurring them all, this 3x1 blur approximates a more complex gaussian.

	const blurFrag = loadText("../shaders/blur.frag");
	const blur = regl({
		frag: regl.prop("frag"),
		uniforms: {
			...uniforms,
			tex: regl.prop("tex"),
			direction: regl.prop("direction"),
			height: regl.context("viewportWidth"),
			width: regl.context("viewportHeight"),
		},
		framebuffer: regl.prop("fbo"),
	});

	// The pyramid of textures gets flattened onto the source texture.
	const flattenPyramid = regl({
		frag: `
			precision mediump float;
			varying vec2 vUV;
			${vBlurPyramid.map((_, index) => `uniform sampler2D pyr_${index};`).join("\n")}
			uniform float bloomStrength;
			void main() {
				vec4 total = vec4(0.);
				${vBlurPyramid.map((_, index) => `total += texture2D(pyr_${index}, vUV) * ${levelStrengths[index]};`).join("\n")}
				gl_FragColor = total * bloomStrength;
			}
		`,
		uniforms: {
			...uniforms,
			...Object.fromEntries(vBlurPyramid.map((fbo, index) => [`pyr_${index}`, fbo])),
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: inputs.primary,
			bloom: output,
		},
		() => {
			for (let i = 0; i < pyramidHeight; i++) {
				const highPassFBO = highPassPyramid[i];
				const hBlurFBO = hBlurPyramid[i];
				const vBlurFBO = vBlurPyramid[i];
				highPass({ fbo: highPassFBO, frag: highPassFrag.text(), tex: inputs.primary });
				blur({ fbo: hBlurFBO, frag: blurFrag.text(), tex: highPassFBO, direction: [1, 0] });
				blur({ fbo: vBlurFBO, frag: blurFrag.text(), tex: hBlurFBO, direction: [0, 1] });
			}

			flattenPyramid();
		},
		(w, h) => {
			// The blur pyramids can be lower resolution than the screen.
			resizePyramid(highPassPyramid, w, h, config.bloomSize);
			resizePyramid(hBlurPyramid, w, h, config.bloomSize);
			resizePyramid(vBlurPyramid, w, h, config.bloomSize);
			output.resize(w, h);
		},
		[highPassFrag.laoded, blurFrag.loaded]
	);
};
