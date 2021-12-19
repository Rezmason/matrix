import { makeFullScreenQuad, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";
import makeResurrectionPass from "./resurrectionPass.js";
import makeQuiltPass from "./quiltPass.js";

import * as HoloPlayCore from "../../lib/holoplaycore.module.js";

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
	await Promise.all([loadJS("lib/regl.js"), loadJS("lib/gl-matrix.js")]);

	const resize = () => {
		canvas.width = Math.ceil(canvas.clientWidth * config.resolution);
		canvas.height = Math.ceil(canvas.clientHeight * config.resolution);
	};
	window.onresize = resize;
	resize();

	const regl = createREGL({
		canvas,
		extensions: ["OES_texture_half_float", "OES_texture_half_float_linear"],
		// These extensions are also needed, but Safari misreports that they are missing
		optionalExtensions: ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"],
	});

	const noDeviceLKG = { tileX: 1, tileY: 1, fov: 90 };
	const lkg = await new Promise((resolve, reject) => {
		const client = new HoloPlayCore.Client((data) => {
			/*
			data = {
				devices: [
					{
						buttons: [ 0, 0, 0, 0 ],
						calibration:
						{
							DPI: { value: 324 },
							center: { value: 0.15018756687641144 },
							configVersion: "3.0",
							flipImageX: { value: 0 },
							flipImageY: { value: 0 },
							flipSubp: { value: 0 },
							fringe: { value: 0 },
							invView: { value: 1 },
							pitch: { value: 52.58013153076172 },
							screenH: { value: 2048 },
							screenW: { value: 1536 },
							slope: { value: -7.145165920257568 },
							verticalAngle: { value: 0 },
							viewCone: { value: 40 }
						},
						defaultQuilt:
						{
							quiltAspect: 0.75,
							quiltX: 3840,
							quiltY: 3840,
							tileX: 8,
							tileY: 6
						},
						hardwareVersion: "portrait",
						hwid: "LKG-P11063",
						index: 0,
						joystickIndex: -1,
						state: "ok",
						unityIndex: 1,
						windowCoords: [ 1440, 900 ]
					}
				],
				error: 0,
				version: "1.2.2"
			};
			/**/


			if (data.devices.length === 0) {
				resolve(noDeviceLKG);
				return;
			}

			const device = data.devices[0];
			const defaultQuilt = device.defaultQuilt;

			const {quiltX, quiltY, tileX, tileY} = defaultQuilt;

			const fov = 15; // But is it?

			const calibration = Object.fromEntries(
				Object.entries(device.calibration)
					.map(([key, value]) => ([key, value.value]))
					.filter(([key, value]) => (value != null))
			);

			const screenInches = calibration.screenW / calibration.DPI;
			const pitch = calibration.pitch * screenInches * Math.cos(Math.atan(1.0 / calibration.slope));
			const tilt = calibration.screenH / (calibration.screenW * calibration.slope) * (calibration.flipImageX * 2 - 1);
			const subp = 1 / (calibration.screenW * 3);

			const quiltViewPortion = [
				(Math.floor(quiltX / tileX) * tileX) / quiltX,
				(Math.floor(quiltY / tileY) * tileY) / quiltY,
			];

			const output = {
				...defaultQuilt,
				...calibration,
				pitch,
				tilt,
				subp,

				quiltViewPortion,
				fov
			};

			resolve(output);
		}, (error) => {
			console.warn("Holoplay connection error:", error);
			resolve(noDeviceLKG);
		});
	});

	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);
	const effectName = config.effect in effects ? config.effect : "plain";
	const pipeline = makePipeline({ regl, config, lkg }, [makeRain, makeBloomPass, effects[effectName], makeQuiltPass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));
	const tick = regl.frame(({ viewportWidth, viewportHeight }) => {
		// tick.cancel();
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
	});
};
