import { makeFullScreenQuad, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeQuiltPass from "./quiltPass.js";
import makeMirrorPass from "./mirrorPass.js";
import { setupCamera, cameraCanvas, cameraAspectRatio } from "../camera.js";
import getLKG from "./lkgHelper.js";
import colorToRGB from "../colorToRGB.js";

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

const dimensions = { width: 1, height: 1 };

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

export default async (canvas, config) => {
	await Promise.all([loadJS("lib/regl.min.js"), loadJS("lib/gl-matrix.js")]);

	if (config.pageBGURL) {
		document.body.style.backgroundImage = `url(${config.pageBGURL})`
	}
	else {
		let colors = colorToRGB(config.backgroundColor).map( e => e * 100 );
		let colorStyle = `rgb(${colors[0]}%, ${colors[1]}%, ${colors[2]}%)`;
		document.body.style.backgroundColor = colorStyle;
	}

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

	if (config.useCamera) {
		await setupCamera();
	}

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	// These extensions are also needed, but Safari misreports that they are missing
	const optionalExtensions = ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"];

	switch (config.testFix) {
		case "fwidth_10_1_2022_A":
			extensions.push("OES_standard_derivatives");
			break;
		case "fwidth_10_1_2022_B":
			optionalExtensions.forEach((ext) => extensions.push(ext));
			extensions.length = 0;
			break;
	}

	const regl = createREGL({ canvas, pixelRatio: 1, extensions, optionalExtensions });

	const cameraTex = regl.texture(cameraCanvas);
	const lkg = await getLKG(config.useHoloplay, true);

	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);
	const effectName = config.effect in effects ? config.effect : "palette";
	const context = { regl, config, lkg, cameraTex, cameraAspectRatio };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, effects[effectName], makeQuiltPass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));

	const targetFrameTimeMilliseconds = 1000 / config.fps;
	let last = NaN;

	const tick = regl.frame(({ viewportWidth, viewportHeight }) => {
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
	});
};
