import { makeFullScreenQuad, makePipeline } from "./utils.js";
import makeConfig from "./config.js";
import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeResurrectionPass from "./resurrectionPass.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

const regl = createREGL({
	canvas,
	extensions: ["OES_texture_half_float", "OES_texture_half_float_linear"],
	// These extensions are also needed, but Safari misreports that they are missing
	optionalExtensions: ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"],
});

const effects = {
	none: null,
	plain: makePalettePass,
	customStripes: makeStripePass,
	stripes: makeStripePass,
	pride: makeStripePass,
	transPride: makeStripePass,
	trans: makeStripePass,
	image: makeImagePass,
	resurrection: makeResurrectionPass,
	resurrections: makeResurrectionPass,
};

const config = makeConfig(window.location.search);
const resolution = config.resolution;
const effect = config.effect in effects ? config.effect : "plain";

const resize = () => {
	canvas.width = Math.ceil(canvas.clientWidth * resolution);
	canvas.height = Math.ceil(canvas.clientHeight * resolution);
};
window.onresize = resize;
resize();

const dimensions = { width: 1, height: 1 };

document.body.onload = async () => {
	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);

	const bloomPass = effect === "none" ? null : makeBloomPass;
	const pipeline = makePipeline([makeRain, bloomPass, effects[effect]], (p) => p.outputs, regl, config);
	const uniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms });
	await Promise.all(pipeline.map(({ ready }) => ready));
	const tick = regl.frame(({ viewportWidth, viewportHeight }) => {
		// tick.cancel();
		if (dimensions.width !== viewportWidth || dimensions.height !== viewportHeight) {
			dimensions.width = viewportWidth;
			dimensions.height = viewportHeight;
			for (const step of pipeline) {
				step.resize(viewportWidth, viewportHeight);
			}
		}
		fullScreenQuad(() => {
			for (const step of pipeline) {
				step.render();
			}
			drawToScreen();
		});
	});
};
