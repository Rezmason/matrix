const hsl = (...values) => ({ space: "hsl", values });

const config = {
	glyphMSDFURL: "assets/matrixcode_msdf.png",
	glyphSequenceLength: 57,
	glyphTextureGridSize: [8, 8],
	backgroundColor: hsl(0, 0, 0), // The color "behind" the glyphs
	isolateCursor: true, // Whether the "cursor"— the brightest glyph at the bottom of a raindrop— has its own color
	cursorColor: hsl(0.242, 1, 0.73), // The color of the cursor
	cursorIntensity: 2, // The intensity of the cursor
	glintColor: hsl(0, 0, 1), // The color of the glint
	glintIntensity: 1, // The intensity of the glint
	animationSpeed: 1, // The global rate that all animations progress
	fps: 60, // The target frame rate (frames per second) of the effect
	forwardSpeed: 0.25, // The speed volumetric rain approaches the eye
	bloomStrength: 0.7, // The intensity of the bloom
	bloomSize: 0.4, // The amount the bloom calculation is scaled
	highPassThreshold: 0.1, // The minimum brightness that is still blurred
	cycleSpeed: 0.03, // The speed glyphs change
	cycleFrameSkip: 1, // The global minimum number of frames between glyphs cycling
	baseBrightness: -0.5, // The brightness of the glyphs, before any effects are applied
	baseContrast: 1.1, // The contrast of the glyphs, before any effects are applied
	glintBrightness: -1.5, // The brightness of the glints, before any effects are applied
	glintContrast: 2.5, // The contrast of the glints, before any effects are applied
	brightnessOverride: 0.0, // A global override to the brightness of displayed glyphs. Only used if it is > 0.
	brightnessThreshold: 0, // The minimum brightness for a glyph to still be considered visible
	ditherMagnitude: 0.05, // The magnitude of the random per-pixel dimming
	fallSpeed: 0.3, // The speed the raindrops progress downwards
	glyphEdgeCrop: 0.0, // The border around a glyph in a font texture that should be cropped out
	glyphHeightToWidth: 1, // The aspect ratio of glyphs
	glyphVerticalSpacing: 1, // The ratio of the vertical distance between glyphs to their height
	numColumns: 80, // The maximum dimension of the glyph grid
	palette: [
		// The color palette that glyph brightness is color mapped to
		{ color: hsl(0.3, 0.9, 0.0), at: 0.0 },
		{ color: hsl(0.3, 0.9, 0.2), at: 0.2 },
		{ color: hsl(0.3, 0.9, 0.7), at: 0.7 },
		{ color: hsl(0.3, 0.9, 0.8), at: 0.8 },
	],
	raindropLength: 0.75, // Adjusts the frequency of raindrops (and their length) in a column
	resolution: 0.75, // An overall scale multiplier
	useHalfFloat: false,
};

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
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
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
	const context = { regl, config };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, makePalettePass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));

	const targetFrameTimeMilliseconds = 1000 / config.fps;
	let last = NaN;

	const render = ({ viewportWidth, viewportHeight }) => {
		if (config.once) {
			tick.cancel();
		}

		const now = regl.now() * 1000;

		if (isNaN(last)) {
			last = now;
		}

		const shouldRender = config.fps >= 60 || now - last >= targetFrameTimeMilliseconds || config.once == true;

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
	};

	render({viewportWidth: 1, viewportHeight: 1});

	const tick = regl.frame(render);
};

document.body.onload = () => {
	init();
}
