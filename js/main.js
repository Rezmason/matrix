const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

import { makeFullScreenQuad, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";

const dimensions = { width: 1, height: 1 };

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

const init = async () => {
	await loadJS("lib/regl.js");

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * 0.75);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * 0.75);
	};
	window.onresize = resize;
	if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
		window.ondblclick = () => {
			if (document.fullscreenElement == null) {
				if (canvas.webkitRequestFullscreen != null) {
					canvas.webkitRequestFullscreen();
				} else {
					canvas.requestFullscreen();
				}
			} else {
				document.exitFullscreen();
			}
		};
	}
	resize();

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	// These extensions are also needed, but Safari misreports that they are missing
	const optionalExtensions = ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"];

	const regl = createREGL({ canvas, pixelRatio: 1, extensions, optionalExtensions });

	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);
	const pipeline = makePipeline({ regl }, [makeRain, makeBloomPass, makePalettePass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));

	const render = ({ viewportWidth, viewportHeight }) => {
		const now = regl.now() * 1000;

		if (dimensions.width !== viewportWidth || dimensions.height !== viewportHeight) {
			dimensions.width = viewportWidth;
			dimensions.height = viewportHeight;
			for (const step of pipeline) {
				step.setSize(viewportWidth, viewportHeight);
			}
		}
		fullScreenQuad(() => {
			for (const step of pipeline) {
				step.execute();
			}
			drawToScreen();
		});
	};

	render({ viewportWidth: 1, viewportHeight: 1 });

	const tick = regl.frame(render);
};

document.body.onload = () => {
	init();
};
