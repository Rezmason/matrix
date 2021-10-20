import { loadText, extractEntries, make1DTexture, makePassFBO, makePass } from "./utils.js";

const colorToRGB = ([hue, saturation, lightness]) => {
	const a = saturation * Math.min(lightness, 1 - lightness);
	const f = (n) => {
		const k = (n + hue * 12) % 12;
		return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
};

const makePalette = (regl, entries) => {
	const PALETTE_SIZE = 2048;
	const paletteColors = Array(PALETTE_SIZE);
	const sortedEntries = entries
		.slice()
		.sort((e1, e2) => e1.at - e2.at)
		.map((entry) => ({
			rgb: colorToRGB(entry.hsl),
			arrayIndex: Math.floor(Math.max(Math.min(1, entry.at), 0) * (PALETTE_SIZE - 1)),
		}));
	sortedEntries.unshift({ rgb: sortedEntries[0].rgb, arrayIndex: 0 });
	sortedEntries.push({
		rgb: sortedEntries[sortedEntries.length - 1].rgb,
		arrayIndex: PALETTE_SIZE - 1,
	});
	sortedEntries.forEach((entry, index) => {
		paletteColors[entry.arrayIndex] = entry.rgb.slice();
		if (index + 1 < sortedEntries.length) {
			const nextEntry = sortedEntries[index + 1];
			const diff = nextEntry.arrayIndex - entry.arrayIndex;
			for (let i = 0; i < diff; i++) {
				const ratio = i / diff;
				paletteColors[entry.arrayIndex + i] = [
					entry.rgb[0] * (1 - ratio) + nextEntry.rgb[0] * ratio,
					entry.rgb[1] * (1 - ratio) + nextEntry.rgb[1] * ratio,
					entry.rgb[2] * (1 - ratio) + nextEntry.rgb[2] * ratio,
				];
			}
		}
	});

	return make1DTexture(
		regl,
		paletteColors.flat().map((i) => i * 0xff)
	);
};

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default (regl, config, inputs) => {
	const output = makePassFBO(regl, config.useHalfFloat);
	const palette = makePalette(regl, config.paletteEntries);

	const palettePassFrag = loadText("../shaders/palettePass.frag");

	const render = regl({
		frag: regl.prop("frag"),

		uniforms: {
			...extractEntries(config, ["backgroundColor"]),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			palette,
			ditherMagnitude: 0.05,
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: output,
		},
		() => render({ frag: palettePassFrag.text() }),
		null,
		palettePassFrag.loaded
	);
};
