import { makeFullScreenQuad, makePipeline } from "./utils.js";
import fetchLibraries from "../fetchLibraries.js";
import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeMirrorPass from "./mirrorPass.js";
import { setupCamera, cameraCanvas, cameraAspectRatio } from "../utils/camera.js";

const effects = {
	none: null,
	plain: makePalettePass,
	palette: makePalettePass,
	customStripes: makeStripePass,
	stripes: makeStripePass,
	pride: makeStripePass,
	transPride: makeStripePass,
	trans: makeStripePass,
	image: makeImagePass,
	mirror: makeMirrorPass,
};

let createREGL, glMatrix;

export const init = async (canvas) => {
	const libraries = await fetchLibraries();
	createREGL = libraries.createREGL;
	glMatrix = libraries.glMatrix;

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * rain.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * rain.resolution);
	};

	const doubleClick = () => {
		if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) {
			return;
		}
		if (document.fullscreenElement != null) {
			document.exitFullscreen();
			return;
		}
		if (canvas.webkitRequestFullscreen != null) {
			canvas.webkitRequestFullscreen();
		} else {
			canvas.requestFullscreen();
		}
	};

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	// These extensions are also needed, but Safari misreports that they are missing
	const optionalExtensions = [
		"EXT_color_buffer_half_float",
		"WEBGL_color_buffer_float",
		"OES_standard_derivatives",
	];

	const regl = createREGL({ canvas, pixelRatio: 1, extensions, optionalExtensions });
	const cache = new Map();
	const rain = { canvas, resize, doubleClick, cache, regl, resolution: 1 };

	window.addEventListener("dblclick", doubleClick);
	window.addEventListener("resize", resize);
	resize();

	return rain;
};

export const formulate = async (rain, config) => {
	if (rain.destroyed) {
		throw new Error("Cannot formulate a destroyed rain instance.");
	}
	const { resize, canvas, cache, regl } = rain;
	rain.resolution = config.resolution;
	resize();

	const dimensions = { width: 1, height: 1 };

	if (config.useCamera) {
		await setupCamera();
	}

	const cameraTex = regl.texture(cameraCanvas);

	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);
	const effectName = config.effect in effects ? config.effect : "palette";
	const context = { regl, cache, config, cameraTex, cameraAspectRatio, glMatrix };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, effects[effectName]]);

	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));
	pipeline.forEach((step) => step.setSize(canvas.width, canvas.height));
	dimensions.width = canvas.width;
	dimensions.height = canvas.height;

	const targetFrameTimeMilliseconds = 1000 / config.fps;
	let last = NaN;

	resetREGLTime: {
		const reset = regl.frame((o) => {
			o.time = 0;
			o.tick = 0;
			reset.cancel();
		});
	}

	const tick = regl.frame(({ viewportWidth, viewportHeight }) => {
		if (config.once) {
			tick.cancel();
		}

		const now = regl.now() * 1000;

		if (isNaN(last)) {
			last = now;
		}

		const shouldRender =
			config.fps >= 60 || now - last >= targetFrameTimeMilliseconds || config.once == true;

		if (shouldRender) {
			while (now - targetFrameTimeMilliseconds > last) {
				last += targetFrameTimeMilliseconds;
			}
		}

		if (config.useCamera) {
			cameraTex(cameraCanvas);
		}
		if (dimensions.width !== viewportWidth || dimensions.height !== viewportHeight) {
			dimensions.width = viewportWidth;
			dimensions.height = viewportHeight;
			for (const step of pipeline) {
				step.setSize(viewportWidth, viewportHeight);
			}
		}
		fullScreenQuad(() => {
			for (const step of pipeline) {
				step.execute(shouldRender);
			}
			drawToScreen();
		});
	});

	if (rain.tick != null) {
		rain.tick.cancel();
	}

	rain.tick = tick;
};

export const destroy = (rain) => {
	if (rain.destroyed) {
		return;
	}
	const { regl, cache, resize, doubleClick, tick, canvas } = rain;
	window.removeEventListener("resize", resize);
	window.removeEventListener("dblclick", doubleClick);
	cache.clear();
	tick.cancel(); // stop RAF
	regl.destroy(); // release all GPU resources & event listeners
	rain.destroyed = true;
};

export const type = "regl";
