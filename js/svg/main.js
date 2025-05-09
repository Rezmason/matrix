import { makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";

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

export default async (artboard, config) => {
	await Promise.all([loadJS("lib/gl-matrix.js")]);

	const rect = artboard.getBoundingClientRect();
	[dimensions.width, dimensions.height] = [rect.width, rect.height];

	if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
		window.ondblclick = () => {
			if (document.fullscreenElement == null) {
				if (artboard.webkitRequestFullscreen != null) {
					artboard.webkitRequestFullscreen();
				} else {
					artboard.requestFullscreen();
				}
			} else {
				document.exitFullscreen();
			}
		};
	}

	const effectName = config.effect in effects ? config.effect : "palette";
	const context = { artboard, config };
	const pipeline = makePipeline(context, [makeRain, effects[effectName]]);
	await Promise.all(pipeline.map((step) => step.ready));

	for (const step of pipeline) {
		step.setSize(dimensions.width, dimensions.height);
	}

	for (const step of pipeline) {
		step.execute(true);
	}
};
