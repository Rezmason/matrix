import Renderer from "../renderer.js";
import { makeFullScreenQuad, makePipeline, trackResources } from "./utils.js";

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

export default class REGLRenderer extends Renderer {
	#renderFunc;
	#regl;
	#glMatrix;
	#configureIndex = 0;
	#pipelineRegl = null;

	constructor() {
		super("regl", async () => {
			const libraries = await Renderer.libraries;
			const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
			// These extensions are also needed, but Safari misreports that they are missing
			const optionalExtensions = [
				"EXT_color_buffer_half_float",
				"WEBGL_color_buffer_float",
				"OES_standard_derivatives",
			];
			this.#regl = libraries.createREGL({
				canvas: this.canvas,
				pixelRatio: 1,
				extensions,
				optionalExtensions,
			});
			this.#glMatrix = libraries.glMatrix;
		});
	}

	async configure(config) {
		const index = ++this.#configureIndex;
		await super.configure(config);

		if (config.useCamera) {
			await setupCamera();
		}
		if (index !== this.#configureIndex || this.destroyed) return;

		const canvas = this.canvas;
		const cache = this.cache;
		// Everything this pipeline allocates, so it can be freed when replaced
		const regl = trackResources(this.#regl);
		const glMatrix = this.#glMatrix;
		const dimensions = { width: 1, height: 1 };
		const cameraTex = regl.texture(cameraCanvas);

		// All this takes place in a full screen quad.
		const fullScreenQuad = makeFullScreenQuad(regl);
		const effectName = config.effect in effects ? config.effect : "palette";
		const context = { regl, canvas, cache, config, cameraTex, cameraAspectRatio, glMatrix };
		const pipeline = makePipeline(context, [makeRain, makeBloomPass, effects[effectName]]);

		const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
		const drawToScreen = regl({ uniforms: screenUniforms });
		await Promise.all(pipeline.map((step) => step.ready));
		if (this.destroyed) return;
		// A newer configure call started while this one was loading, and replaces it
		if (index !== this.#configureIndex) {
			regl.destroyResources();
			return;
		}
		pipeline.forEach((step) => step.setSize(canvas.width, canvas.height));
		dimensions.width = canvas.width;
		dimensions.height = canvas.height;

		const targetFrameTimeMilliseconds = 1000 / config.fps;
		let last = NaN;

		const reset = regl.frame((reglContext) => {
			reglContext.tick = 0;
			reset.cancel();
		});

		this.#renderFunc = (reglContext) => {
			if (config.once) {
				this.stop();
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
			const { viewportWidth, viewportHeight } = reglContext;
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

		// The new pipeline is live; free the one it replaced
		this.#pipelineRegl?.destroyResources();
		this.#pipelineRegl = regl;

		const frame = this.#regl.frame((o) => {
			this.#renderFunc(o);
			frame.cancel();
		});
	}

	stop() {
		super.stop();
		this.#renderFunc = null;
	}

	update(now) {
		if (this.#renderFunc != null) {
			const frame = this.#regl.frame((o) => {
				this.#renderFunc(o);
				frame.cancel();
			});
		}
		super.update(now);
	}

	destroy() {
		if (this.destroyed) return;
		this.#regl.destroy(); // releases all GPU resources & event listeners
		super.destroy();
	}
}
