import { loadText, makePassFBO, makePass } from "./utils.js";

const pyramidHeight = 5;

const makePyramid = (regl, height, halfFloat) =>
	Array(height)
		.fill()
		.map((_) => makePassFBO(regl, halfFloat));

const resizePyramid = (pyramid, vw, vh, scale) =>
	pyramid.forEach((fbo, index) => fbo.resize(Math.floor((vw * scale) / 2 ** index), Math.floor((vh * scale) / 2 ** index)));

export default ({ regl }, inputs) => {
	const bloomStrength = 0.7; // The intensity of the bloom
	const bloomSize = 0.4; // The amount the bloom calculation is scaled
	const highPassThreshold = 0.1; // The minimum brightness that is still blurred

	const highPassPyramid = makePyramid(regl, pyramidHeight);
	const hBlurPyramid = makePyramid(regl, pyramidHeight);
	const vBlurPyramid = makePyramid(regl, pyramidHeight);
	const output = makePassFBO(regl);

	const highPass = regl({
		frag: `
			precision mediump float;

			uniform sampler2D tex;
			uniform float highPassThreshold;

			varying vec2 vUV;

			void main() {
				vec4 color = texture2D(tex, vUV);
				if (color.r < highPassThreshold) color.r = 0.0;
				if (color.g < highPassThreshold) color.g = 0.0;
				if (color.b < highPassThreshold) color.b = 0.0;
				gl_FragColor = color;
			}
		`,
		uniforms: {
			highPassThreshold,
			tex: regl.prop("tex"),
		},
		framebuffer: regl.prop("fbo"),
	});

	const blur = regl({
		frag: `
			precision mediump float;

			uniform float width, height;
			uniform sampler2D tex;
			uniform vec2 direction;

			varying vec2 vUV;

			void main() {
				vec2 size = width > height ? vec2(width / height, 1.) : vec2(1., height / width);
				gl_FragColor =
					texture2D(tex, vUV) * 0.442 +
					(
						texture2D(tex, vUV + direction / max(width, height) * size) +
						texture2D(tex, vUV - direction / max(width, height) * size)
					) * 0.279;
			}
		`,
		uniforms: {
			tex: regl.prop("tex"),
			direction: regl.prop("direction"),
			height: regl.context("viewportWidth"),
			width: regl.context("viewportHeight"),
		},
		framebuffer: regl.prop("fbo"),
	});

	// The pyramid of textures gets flattened (summed) into a final blurry "bloom" texture
	const combine = regl({
		frag: `
			precision mediump float;

			uniform sampler2D pyr_0, pyr_1, pyr_2, pyr_3, pyr_4;
			uniform float bloomStrength;
			varying vec2 vUV;

			void main() {
				vec4 total = vec4(0.);
				total += texture2D(pyr_0, vUV) * 0.96549;
				total += texture2D(pyr_1, vUV) * 0.92832;
				total += texture2D(pyr_2, vUV) * 0.88790;
				total += texture2D(pyr_3, vUV) * 0.84343;
				total += texture2D(pyr_4, vUV) * 0.79370;
				gl_FragColor = total * bloomStrength;
			}
		`,
		uniforms: {
			bloomStrength,
			...Object.fromEntries(vBlurPyramid.map((fbo, index) => [`pyr_${index}`, fbo])),
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: inputs.primary,
			bloom: output,
		},
		null,
		(w, h) => {
			// The blur pyramids can be lower resolution than the screen.
			resizePyramid(highPassPyramid, w, h, bloomSize);
			resizePyramid(hBlurPyramid, w, h, bloomSize);
			resizePyramid(vBlurPyramid, w, h, bloomSize);
			output.resize(w, h);
		},
		() => {
			for (let i = 0; i < pyramidHeight; i++) {
				const highPassFBO = highPassPyramid[i];
				const hBlurFBO = hBlurPyramid[i];
				const vBlurFBO = vBlurPyramid[i];
				highPass({ fbo: highPassFBO, tex: i === 0 ? inputs.primary : highPassPyramid[i - 1] });
				blur({ fbo: hBlurFBO, tex: highPassFBO, direction: [1, 0] });
				blur({ fbo: vBlurFBO, tex: hBlurFBO, direction: [0, 1] });
			}

			combine();
		}
	);
};
