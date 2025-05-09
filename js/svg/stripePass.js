import colorToRGB from "../colorToRGB.js";
import { loadText, makeLinearGradient, makePassSVG, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a 1D gradient texture
// generated from the passed-in color sequence

// This shader introduces noise into the renders, to avoid banding

const transPrideStripeColors = [
	{ space: "rgb", values: [0.36, 0.81, 0.98] },
	{ space: "rgb", values: [0.96, 0.66, 0.72] },
	{ space: "rgb", values: [1.0, 1.0, 1.0] },
	{ space: "rgb", values: [0.96, 0.66, 0.72] },
	{ space: "rgb", values: [0.36, 0.81, 0.98] },
]
	.map((color) => Array(3).fill(color))
	.flat();

const prideStripeColors = [
	{ space: "rgb", values: [0.89, 0.01, 0.01] },
	{ space: "rgb", values: [1.0, 0.55, 0.0] },
	{ space: "rgb", values: [1.0, 0.93, 0.0] },
	{ space: "rgb", values: [0.0, 0.5, 0.15] },
	{ space: "rgb", values: [0.0, 0.3, 1.0] },
	{ space: "rgb", values: [0.46, 0.03, 0.53] },
]
	.map((color) => Array(2).fill(color))
	.flat();

export default ({ config }, inputs) => {
	const output = makePassSVG();

	const { backgroundColor, cursorColor, glintColor, cursorIntensity, glintIntensity, ditherMagnitude } = config;

	// Expand and convert stripe colors into 1D texture data
	const stripeColors = "stripeColors" in config ? config.stripeColors : config.effect === "pride" ? prideStripeColors : transPrideStripeColors;
	const stripeTex = makeLinearGradient(
		stripeColors.map((color) => [...colorToRGB(color), 1])
	);

	const render = () => {

	};

	return makePass(
		{
			primary: output,
		},
		null,
		(w, h) => {
			// output.resize(w, h);
		},
		(shouldRender) => {
			if (shouldRender) {
				render();
			}
		}
	);
};
