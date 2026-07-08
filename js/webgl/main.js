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
import { setupFullscreenToggle } from "../fullscreen.js";
import { createEffectsMapping, getEffectPass } from "../effects.js";

const dimensions = { width: 1, height: 1 };

/**
 * Surface the first shader compile / program link failure (otherwise the browser only shows
 * INVALID_OPERATION: useProgram: program not valid and then suppresses further errors).
 */
function installWebGLShaderDebugHooks() {
	if (typeof WebGLRenderingContext === "undefined") {
		return;
	}
	const proto = WebGLRenderingContext.prototype;
	if (proto.__matrixShaderDebugHooked) {
		return;
	}
	proto.__matrixShaderDebugHooked = true;
	const compileShader = proto.compileShader;
	proto.compileShader = function (shader) {
		compileShader.call(this, shader);
		if (!this.getShaderParameter(shader, this.COMPILE_STATUS)) {
			console.error("[Matrix][WebGL] shader compile failed:\n", this.getShaderInfoLog(shader));
		}
	};
	const linkProgram = proto.linkProgram;
	proto.linkProgram = function (program) {
		linkProgram.call(this, program);
		if (!this.getProgramParameter(program, this.LINK_STATUS)) {
			console.error("[Matrix][WebGL] program link failed:\n", this.getProgramInfoLog(program));
		}
	};
}

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
	installWebGLShaderDebugHooks();

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * config.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * config.resolution);
	};
	window.onresize = resize;
	const recalcOnFullscreenChange = () => {
		resize();
		if (config.useCamera) {
			device.queue.copyExternalImageToTexture({ source: cameraCanvas }, { texture: cameraTex }, cameraSize);
		}
	};
	document.addEventListener("fullscreenchange", recalcOnFullscreenChange);
	document.addEventListener("webkitfullscreenchange", recalcOnFullscreenChange);
	document.addEventListener("mozfullscreenchange", recalcOnFullscreenChange);
	document.addEventListener("MSFullscreenChange", recalcOnFullscreenChange);

	// Setup fullscreen toggle with proper cleanup
	const cleanupFullscreen = setupFullscreenToggle(canvas);

	resize();

	if (config.useCamera) {
		await setupCamera();
	}

	const extensions = [
		"OES_texture_half_float",
		"OES_texture_half_float_linear",
		"OES_standard_derivatives",
		// Required to render into half-float FBOs (compute passes + rain); without it, framebuffer attachments can be incomplete.
		"EXT_color_buffer_half_float",
	];
	// rainPass.frag.glsl uses fwidth() for MSDF anti-aliasing (OES_standard_derivatives).
	// Some older stacks only expose float renderbuffers under a different name — regl may still enable it.
	const optionalExtensions = ["WEBGL_color_buffer_float"];

	switch (config.testFix) {
		case "fwidth_10_1_2022_A":
			extensions.push("OES_standard_derivatives");
			break;
		case "fwidth_10_1_2022_B":
			optionalExtensions.forEach((ext) => extensions.push(ext));
			extensions.length = 0;
			break;
	}

	const regl = createREGL({
		canvas,
		pixelRatio: 1,
		extensions,
		optionalExtensions,
	});

	const cameraTex = regl.texture(cameraCanvas);
	const lkg = await getLKG(config.useHoloplay, true);

	// Create dynamic effects mapping
	const passModules = {
		makePalettePass,
		makeStripePass,
		makeImagePass,
		makeMirrorPass,
	};
	const effects = createEffectsMapping("webgl", passModules);
	const effectPass = getEffectPass(config.effect, effects, "palette");
	const context = { regl, canvas, config, lkg, cameraTex, cameraAspectRatio };
	const pipeline = makePipeline(context, [makeRain, makeBloomPass, effectPass, makeQuiltPass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	// Blit the final texture to the canvas. A nested `regl({ uniforms })` inside another draw can
	// inherit the last pass's framebuffer binding, so the screen never gets the composed image.
	const blitToCanvas = makeFullScreenQuad(regl, screenUniforms);
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
		for (const step of pipeline) {
			step.execute(shouldRender);
		}
		blitToCanvas();
	});
};
