import { structs } from "/lib/gpu-buffer.js";
import { loadShader, makeUniformBuffer, makeBindGroup, makeRenderTarget, makePass } from "./utils.js";

// The bloom pass is basically an added blur of the high-pass rendered output.
// The blur approximation is the sum of a pyramid of downscaled textures.

const pyramidHeight = 5;
const levelStrengths = Array(pyramidHeight)
	.fill()
	.map((_, index) => Math.pow(index / (pyramidHeight * 2) + 0.5, 1 / 3).toPrecision(5))
	.reverse();

export default (context, getInputs) => {
	const { config, device, canvasFormat } = context;

	const enabled = config.bloomSize > 0 && config.bloomStrength > 0;

	// If there's no bloom to apply, return a no-op pass with an empty bloom texture
	if (!enabled) {
		const emptyTexture = makeRenderTarget(device, 1, 1, canvasFormat);
		const getOutputs = () => ({ ...getInputs(), bloom: emptyTexture });
		return makePass(getOutputs);
	}

	const assets = [loadShader(device, "shaders/wgsl/blur1D.wgsl")];

	// TODO: generate sum shader code

	const renderTarget = makeRenderTarget(device, 1, 1, canvasFormat);
	const getOutputs = () => ({ ...getInputs(), bloom: renderTarget }); // TODO

	let blurRenderPipeline;
	let sumRenderPipeline;

	const ready = (async () => {
		const [blurShader] = await Promise.all(assets);
		// TODO: create sum shader
		// TODO: create config buffer

		// TODO: create blur render pipeline
		// TODO: create sum render pipeline
	})();

	const setSize = (width, height) => {
		// TODO: destroy output
		// TODO: create output
		// TODO: destroy pyramid textures
		// TODO: create new pyramid textures
		// TODO: create new pyramid bindings
		// TODO: create new pyramid renderPassConfigs
	};

	const execute = (encoder) => {
		const inputs = getInputs();

		// TODO: set pipeline to blur pipeline
		// TODO: bind config/source buffer group
		// TODO: for every level,
		//		horizontally blur inputs.primary to horizontal blur output
		//		vertically blur the horizontal blur output to vertical blur output

		// TODO: set pipeline to the sum pipeline
		// TODO: set bind group (vertical blur outputs)
		// TODO: sum vertical blur into output
	};

	return makePass(getOutputs, ready, setSize, execute);
};

/*

// A pyramid is just an array of Targets, where each Target is half the width
// and half the height of the Target below it.
const makePyramid = (regl, height, halfFloat) =>
	Array(height)
		.fill()
		.map((_) => makeRenderTarget(regl, halfFloat));

const resizePyramid = (pyramid, vw, vh, scale) =>
	pyramid.forEach((fbo, index) => fbo.resize(Math.floor((vw * scale) / 2 ** index), Math.floor((vh * scale) / 2 ** index)));

export default ({ regl, config }, inputs) => {

	// Build three pyramids of Targets, one for each step in the process
	const highPassPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const hBlurPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const vBlurPyramid = makePyramid(regl, pyramidHeight, config.useHalfFloat);
	const output = makeRenderTarget(regl, config.useHalfFloat);

	// The high pass restricts the blur to bright things in our input texture.
	const highPassFrag = loadText("shaders/glsl/highPass.frag.glsl");
	const highPass = regl({
		frag: regl.prop("frag"),
		uniforms: {
			highPassThreshold,
			tex: regl.prop("tex"),
		},
		framebuffer: regl.prop("fbo"),
	});

	// A 2D gaussian blur is just a 1D blur done horizontally, then done vertically.
	// The Target pyramid's levels represent separate levels of detail;
	// by blurring them all, this basic blur approximates a more complex gaussian:
	// https://web.archive.org/web/20191124072602/https://software.intel.com/en-us/articles/compute-shader-hdr-and-bloom

	const blurFrag = loadText("shaders/glsl/blur.frag.glsl");
	const blur = regl({
		frag: regl.prop("frag"),
		uniforms: {
			tex: regl.prop("tex"),
			direction: regl.prop("direction"),
			height: regl.context("viewportWidth"),
			width: regl.context("viewportHeight"),
		},
		framebuffer: regl.prop("fbo"),
	});

	// The pyramid of textures gets flattened (summed) into a final blurry "bloom" texture
	const sumPyramid = regl({
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
		Promise.all([highPassFrag.loaded, blurFrag.loaded]),
		(w, h) => {
			// The blur pyramids can be lower resolution than the screen.
			resizePyramid(highPassPyramid, w, h, bloomSize);
			resizePyramid(hBlurPyramid, w, h, bloomSize);
			resizePyramid(vBlurPyramid, w, h, bloomSize);
			output.resize(w, h);
		},
		() => {
			for (let i = 0; i < pyramidHeight; i++) {
				const highPassTarget = highPassPyramid[i];
				const hBlurTarget = hBlurPyramid[i];
				const vBlurTarget = vBlurPyramid[i];
				highPass({ fbo: highPassTarget, frag: highPassFrag.text(), tex: inputs.primary });
				blur({ fbo: hBlurTarget, frag: blurFrag.text(), tex: highPassTarget, direction: [1, 0] });
				blur({ fbo: vBlurTarget, frag: blurFrag.text(), tex: hBlurTarget, direction: [0, 1] });
			}

			sumPyramid();
		}
	);
};
*/
