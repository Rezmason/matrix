const fonts = {
	coptic: {
		// The script the Gnostic codices were written in
		glyphMSDFURL: "assets/coptic_msdf.png",
		glyphSequenceLength: 32,
		glyphTextureGridSize: [8, 8],
	},
	gothic: {
		// The script the Codex Argenteus was written in
		glyphMSDFURL: "assets/gothic_msdf.png",
		glyphSequenceLength: 27,
		glyphTextureGridSize: [8, 8],
	},
	matrixcode: {
		// The glyphs seen in the film trilogy
		glyphMSDFURL: "assets/matrixcode_msdf.png",
		glyphSequenceLength: 57,
		glyphTextureGridSize: [8, 8],
	},
	megacity: {
		// The glyphs seen in the film trilogy
		glyphMSDFURL: "assets/megacity_msdf.png",
		glyphSequenceLength: 64,
		glyphTextureGridSize: [8, 8],
	},
	resurrections: {
		// The glyphs seen in the film trilogy
		glyphMSDFURL: "assets/resurrections_msdf.png",
		glintMSDFURL: "assets/resurrections_glint_msdf.png",
		glyphSequenceLength: 135,
		glyphTextureGridSize: [13, 12],
	},
	huberfishA: {
		glyphMSDFURL: "assets/huberfish_a_msdf.png",
		glyphSequenceLength: 34,
		glyphTextureGridSize: [6, 6],
	},
	huberfishD: {
		glyphMSDFURL: "assets/huberfish_d_msdf.png",
		glyphSequenceLength: 34,
		glyphTextureGridSize: [6, 6],
	},
	gtarg_tenretniolleh: {
		glyphMSDFURL: "assets/gtarg_tenretniolleh_msdf.png",
		glyphSequenceLength: 36,
		glyphTextureGridSize: [6, 6],
	},
	gtarg_alientext: {
		glyphMSDFURL: "assets/gtarg_alientext_msdf.png",
		glyphSequenceLength: 38,
		glyphTextureGridSize: [8, 5],
	},
	neomatrixology: {
		glyphMSDFURL: "assets/neomatrixology_msdf.png",
		glyphSequenceLength: 12,
		glyphTextureGridSize: [4, 4],
	},
};

const textureURLs = {
	sand: "assets/sand.png",
	pixels: "assets/pixel_grid.png",
	mesh: "assets/mesh.png",
	metal: "assets/metal.png",
};

const hsl = (...values) => ({ space: "hsl", values });
const rgb = (...values) => ({ space: "rgb", values });

const defaults = {
	font: "matrixcode",
	effect: "palette", // The name of the effect to apply at the end of the process— mainly handles coloration
	baseTexture: null, // The name of the texture to apply to the base layer of the glyphs
	glintTexture: null, // The name of the texture to apply to the glint layer of the glyphs
	useCamera: false,
	backgroundColor: hsl(0, 0, 0), // The color "behind" the glyphs
	isolateCursor: true, // Whether the "cursor"— the brightest glyph at the bottom of a raindrop— has its own color
	cursorColor: hsl(0.242, 1, 0.73), // The color of the cursor
	cursorIntensity: 2, // The intensity of the cursor
	isolateGlint: false, // Whether the "glint"— highlights on certain symbols in the font— should appear
	glintColor: hsl(0, 0, 1), // The color of the glint
	glintIntensity: 1, // The intensity of the glint
	volumetric: false, // A mode where the raindrops appear in perspective
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
	brightnessDecay: 1.0, // The rate at which glyphs light up and dim
	ditherMagnitude: 0.05, // The magnitude of the random per-pixel dimming
	fallSpeed: 0.3, // The speed the raindrops progress downwards
	glyphEdgeCrop: 0.0, // The border around a glyph in a font texture that should be cropped out
	glyphHeightToWidth: 1, // The aspect ratio of glyphs
	glyphVerticalSpacing: 1, // The ratio of the vertical distance between glyphs to their height
	hasThunder: false, // An effect that adds dramatic lightning flashes
	isPolar: false, // Whether the glyphs arc across the screen or sit in a standard grid
	rippleTypeName: null, // The variety of the ripple effect
	rippleThickness: 0.2, // The thickness of the ripple effect
	rippleScale: 30, // The size of the ripple effect
	rippleSpeed: 0.2, // The rate at which the ripple effect progresses
	numColumns: 80, // The maximum dimension of the glyph grid
	density: 1, // In volumetric mode, the number of actual columns compared to the grid
	palette: [
		// The color palette that glyph brightness is color mapped to
		{ color: hsl(0.3, 0.9, 0.0), at: 0.0 },
		{ color: hsl(0.3, 0.9, 0.2), at: 0.2 },
		{ color: hsl(0.3, 0.9, 0.7), at: 0.7 },
		{ color: hsl(0.3, 0.9, 0.8), at: 0.8 },
	],
	raindropLength: 0.75, // Adjusts the frequency of raindrops (and their length) in a column
	slant: 0, // The angle at which rain falls; the orientation of the glyph grid
	resolution: 0.75, // An overall scale multiplier
	useHalfFloat: false,
	renderer: "regl", // The preferred web graphics API
	suppressWarnings: false, // Whether to show warnings to visitors on load
	isometric: false,
	useHoloplay: false,
	loops: false,
	skipIntro: true,
	testFix: null,
};

const versions = {
	classic: {},
	megacity: {
		font: "megacity",
		animationSpeed: 0.5,
		width: 40,
	},
	neomatrixology: {
		font: "neomatrixology",
		animationSpeed: 0.8,
		width: 40,
		palette: [
			{ color: hsl(0.15, 0.9, 0.0), at: 0.0 },
			{ color: hsl(0.15, 0.9, 0.2), at: 0.2 },
			{ color: hsl(0.15, 0.9, 0.7), at: 0.7 },
			{ color: hsl(0.15, 0.9, 0.8), at: 0.8 },
		],
		cursorColor: hsl(0.167, 1, 0.75),
		cursorIntensity: 2,
	},
	operator: {
		cursorColor: hsl(0.375, 1, 0.66),
		cursorIntensity: 3,
		bloomSize: 0.6,
		bloomStrength: 0.75,
		highPassThreshold: 0.0,
		cycleSpeed: 0.01,
		cycleFrameSkip: 8,
		brightnessOverride: 0.22,
		brightnessThreshold: 0,
		fallSpeed: 0.6,
		glyphEdgeCrop: 0.15,
		glyphHeightToWidth: 1.35,
		rippleTypeName: "box",
		numColumns: 108,
		palette: [
			{ color: hsl(0.4, 0.8, 0.0), at: 0.0 },
			{ color: hsl(0.4, 0.8, 0.5), at: 0.5 },
			{ color: hsl(0.4, 0.8, 1.0), at: 1.0 },
		],
		raindropLength: 1.5,
	},
	nightmare: {
		font: "gothic",
		isolateCursor: false,
		highPassThreshold: 0.7,
		baseBrightness: -0.8,
		brightnessDecay: 0.75,
		fallSpeed: 1.2,
		hasThunder: true,
		numColumns: 60,
		cycleSpeed: 0.35,
		palette: [
			{ color: hsl(0.0, 1.0, 0.0), at: 0.0 },
			{ color: hsl(0.0, 1.0, 0.2), at: 0.2 },
			{ color: hsl(0.0, 1.0, 0.4), at: 0.4 },
			{ color: hsl(0.1, 1.0, 0.7), at: 0.7 },
			{ color: hsl(0.2, 1.0, 1.0), at: 1.0 },
		],
		raindropLength: 0.5,
		slant: (22.5 * Math.PI) / 180,
	},
	paradise: {
		font: "coptic",
		isolateCursor: false,
		bloomStrength: 1,
		highPassThreshold: 0,
		cycleSpeed: 0.005,
		baseBrightness: -1.3,
		baseContrast: 2,
		brightnessDecay: 0.05,
		fallSpeed: 0.02,
		isPolar: true,
		rippleTypeName: "circle",
		rippleSpeed: 0.1,
		numColumns: 40,
		palette: [
			{ color: hsl(0.0, 0.0, 0.0), at: 0.0 },
			{ color: hsl(0.0, 0.8, 0.3), at: 0.3 },
			{ color: hsl(0.1, 0.8, 0.5), at: 0.5 },
			{ color: hsl(0.1, 1.0, 0.6), at: 0.6 },
			{ color: hsl(0.1, 1.0, 0.9), at: 0.9 },
		],
		raindropLength: 0.4,
	},
	resurrections: {
		font: "resurrections",
		glyphEdgeCrop: 0.1,
		cursorColor: hsl(0.292, 1, 0.8),
		cursorIntensity: 2,
		baseBrightness: -0.7,
		baseContrast: 1.17,
		highPassThreshold: 0,
		numColumns: 70,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		palette: [
			{ color: hsl(0.375, 0.9, 0.0), at: 0.0 },
			{ color: hsl(0.375, 1.0, 0.6), at: 0.92 },
			{ color: hsl(0.375, 1.0, 1.0), at: 1.0 },
		],
	},
	trinity: {
		font: "resurrections",
		glintTexture: "metal",
		baseTexture: "pixels",
		glyphEdgeCrop: 0.1,
		cursorColor: hsl(0.292, 1, 0.8),
		cursorIntensity: 2,
		isolateGlint: true,
		glintColor: hsl(0.131, 1, 0.6),
		glintIntensity: 3,
		glintBrightness: -0.5,
		glintContrast: 1.5,
		baseBrightness: -0.4,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		palette: [
			{ color: hsl(0.37, 0.6, 0.0), at: 0.0 },
			{ color: hsl(0.37, 0.6, 0.5), at: 1.0 },
		],
		cycleSpeed: 0.01,
		volumetric: true,
		forwardSpeed: 0.2,
		raindropLength: 0.3,
		density: 0.75,
	},
	morpheus: {
		font: "resurrections",
		glintTexture: "mesh",
		baseTexture: "metal",
		glyphEdgeCrop: 0.1,
		cursorColor: hsl(0.333, 1, 0.85),
		cursorIntensity: 2,
		isolateGlint: true,
		glintColor: hsl(0.4, 1, 0.5),
		glintIntensity: 2,
		glintBrightness: -1.5,
		glintContrast: 3,
		baseBrightness: -0.3,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		palette: [
			{ color: hsl(0.97, 0.6, 0.0), at: 0.0 },
			{ color: hsl(0.97, 0.6, 0.5), at: 1.0 },
		],
		cycleSpeed: 0.015,
		volumetric: true,
		forwardSpeed: 0.1,
		raindropLength: 0.4,
		density: 0.75,
	},
	bugs: {
		font: "resurrections",
		glintTexture: "sand",
		baseTexture: "metal",
		glyphEdgeCrop: 0.1,
		cursorColor: hsl(0.619, 1, 0.65),
		cursorIntensity: 2,
		isolateGlint: true,
		glintColor: hsl(0.625, 1, 0.6),
		glintIntensity: 3,
		glintBrightness: -1,
		glintContrast: 3,
		baseBrightness: -0.3,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		palette: [
			{ color: hsl(0.12, 0.6, 0.0), at: 0.0 },
			{ color: hsl(0.14, 0.6, 0.5), at: 1.0 },
		],
		cycleSpeed: 0.01,
		volumetric: true,
		forwardSpeed: 0.4,
		raindropLength: 0.3,
		density: 0.75,
	},
	palimpsest: {
		font: "huberfishA",
		isolateCursor: false,
		bloomStrength: 0.2,
		numColumns: 40,
		raindropLength: 1.2,
		cycleFrameSkip: 3,
		fallSpeed: 0.5,
		slant: Math.PI * -0.0625,
		palette: [
			{ color: hsl(0.15, 0.25, 0.9), at: 0.0 },
			{ color: hsl(0.6, 0.8, 0.1), at: 0.4 },
		],
	},
	twilight: {
		font: "huberfishD",
		cursorColor: hsl(0.167, 1, 0.8),
		cursorIntensity: 1.5,
		bloomStrength: 0.1,
		numColumns: 50,
		raindropLength: 0.9,
		fallSpeed: 0.1,
		highPassThreshold: 0.0,
		palette: [
			{ color: hsl(0.6, 1.0, 0.05), at: 0.0 },
			{ color: hsl(0.6, 0.8, 0.1), at: 0.1 },
			{ color: hsl(0.88, 0.8, 0.5), at: 0.5 },
			{ color: hsl(0.15, 1.0, 0.6), at: 0.8 },
			// { color: hsl(0.1, 1.0, 0.9), at: 1.0 },
		],
	},

	holoplay: {
		font: "resurrections",
		glintTexture: "metal",
		glyphEdgeCrop: 0.1,
		cursorColor: hsl(0.292, 1, 0.8),
		cursorIntensity: 2,
		isolateGlint: true,
		glintColor: hsl(0.131, 1, 0.6),
		glintIntensity: 3,
		glintBrightness: -0.5,
		glintContrast: 1.5,
		baseBrightness: -0.4,
		baseContrast: 1.5,
		highPassThreshold: 0,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		palette: [
			{ color: hsl(0.37, 0.6, 0.0), at: 0.0 },
			{ color: hsl(0.37, 0.6, 0.5), at: 1.0 },
		],
		cycleSpeed: 0.01,
		raindropLength: 0.3,

		renderer: "regl",
		numColumns: 20,
		ditherMagnitude: 0,
		bloomStrength: 0,
		volumetric: true,
		forwardSpeed: 0,
		density: 3,
		useHoloplay: true,
	},

	["3d"]: {
		volumetric: true,
		fallSpeed: 0.5,
		cycleSpeed: 0.03,
		baseBrightness: -0.9,
		baseContrast: 1.5,
		raindropLength: 0.3,
	},
};
versions.throwback = versions.operator;
versions.updated = versions.resurrections;
versions["1999"] = versions.operator;
versions["2003"] = versions.classic;
versions["2021"] = versions.resurrections;

const range = (f, min = -Infinity, max = Infinity) => Math.max(min, Math.min(max, f));
const nullNaN = (f) => (isNaN(f) ? null : f);
const isTrue = (s) => s.toLowerCase().includes("true");

const parseColor = (isHSL) => (s) => ({
	space: isHSL ? "hsl" : "rgb",
	values: s.split(",").map(parseFloat),
});

const parseColors = (isHSL) => (s) => {
	const values = s.split(",").map(parseFloat);
	const space = isHSL ? "hsl" : "rgb";
	return Array(Math.floor(values.length / 3))
		.fill()
		.map((_, index) => ({
			space,
			values: values.slice(index * 3, (index + 1) * 3),
		}));
};

const parsePalette = (isHSL) => (s) => {
	const values = s.split(",").map(parseFloat);
	const space = isHSL ? "hsl" : "rgb";
	return Array(Math.floor(values.length / 4))
		.fill()
		.map((_, index) => {
			const colorValues = values.slice(index * 4, (index + 1) * 4);
			return {
				color: {
					space,
					values: colorValues.slice(0, 3),
				},
				at: colorValues[3],
			};
		});
};

const paramMapping = {
	testFix: { key: "testFix", parser: (s) => s },
	version: { key: "version", parser: (s) => s },
	font: { key: "font", parser: (s) => s },
	effect: { key: "effect", parser: (s) => s },
	camera: { key: "useCamera", parser: isTrue },
	width: { key: "numColumns", parser: (s) => nullNaN(parseInt(s)) },
	numColumns: { key: "numColumns", parser: (s) => nullNaN(parseInt(s)) },
	density: { key: "density", parser: (s) => nullNaN(range(parseFloat(s), 0)) },
	resolution: { key: "resolution", parser: (s) => nullNaN(parseFloat(s)) },
	animationSpeed: {
		key: "animationSpeed",
		parser: (s) => nullNaN(parseFloat(s)),
	},
	forwardSpeed: {
		key: "forwardSpeed",
		parser: (s) => nullNaN(parseFloat(s)),
	},
	cycleSpeed: { key: "cycleSpeed", parser: (s) => nullNaN(parseFloat(s)) },
	fallSpeed: { key: "fallSpeed", parser: (s) => nullNaN(parseFloat(s)) },
	raindropLength: {
		key: "raindropLength",
		parser: (s) => nullNaN(parseFloat(s)),
	},
	slant: {
		key: "slant",
		parser: (s) => nullNaN((parseFloat(s) * Math.PI) / 180),
	},
	bloomSize: {
		key: "bloomSize",
		parser: (s) => nullNaN(range(parseFloat(s), 0, 1)),
	},
	bloomStrength: {
		key: "bloomStrength",
		parser: (s) => nullNaN(range(parseFloat(s), 0, 1)),
	},
	ditherMagnitude: {
		key: "ditherMagnitude",
		parser: (s) => nullNaN(range(parseFloat(s), 0, 1)),
	},
	url: { key: "bgURL", parser: (s) => s },
	palette: { key: "palette", parser: parsePalette(false) },
	stripeColors: { key: "stripeColors", parser: parseColors(false) },
	backgroundColor: { key: "backgroundColor", parser: parseColor(false) },
	cursorColor: { key: "cursorColor", parser: parseColor(false) },
	glintColor: { key: "glintColor", parser: parseColor(false) },

	paletteHSL: { key: "palette", parser: parsePalette(true) },
	stripeHSL: { key: "stripeColors", parser: parseColors(true) },
	backgroundHSL: { key: "backgroundColor", parser: parseColor(true) },
	cursorHSL: { key: "cursorColor", parser: parseColor(true) },
	glintHSL: { key: "glintColor", parser: parseColor(true) },

	cursorIntensity: {
		key: "cursorIntensity",
		parser: (s) => nullNaN(range(parseFloat(s), 0, Infinity)),
	},

	glyphIntensity: {
		key: "glyphIntensity",
		parser: (s) => nullNaN(range(parseFloat(s), 0, Infinity)),
	},

	volumetric: { key: "volumetric", parser: isTrue },
	loops: { key: "loops", parser: isTrue },
	fps: { key: "fps", parser: (s) => nullNaN(range(parseFloat(s), 0, 60)) },
	skipIntro: { key: "skipIntro", parser: isTrue },
	renderer: { key: "renderer", parser: (s) => s },
	suppressWarnings: { key: "suppressWarnings", parser: isTrue },
	once: { key: "once", parser: isTrue },
	isometric: { key: "isometric", parser: isTrue },
};

paramMapping.paletteRGB = paramMapping.palette;
paramMapping.stripeRGB = paramMapping.stripeColors;
paramMapping.backgroundRGB = paramMapping.backgroundColor;
paramMapping.cursorRGB = paramMapping.cursorColor;
paramMapping.glintRGB = paramMapping.glintColor;

paramMapping.dropLength = paramMapping.raindropLength;
paramMapping.angle = paramMapping.slant;
paramMapping.colors = paramMapping.stripeColors;

export default (urlParams) => {
	const validParams = Object.fromEntries(
		Array.from(Object.entries(urlParams))
			.filter(([key]) => key in paramMapping)
			.map(([key, value]) => [paramMapping[key].key, paramMapping[key].parser(value)])
			.filter(([_, value]) => value != null)
	);

	if (validParams.effect != null) {
		if (validParams.cursorColor == null) {
			validParams.cursorColor = hsl(0, 0, 1);
		}

		if (validParams.cursorIntensity == null) {
			validParams.cursorIntensity = 2;
		}

		if (validParams.glintColor == null) {
			validParams.glintColor = hsl(0, 0, 1);
		}

		if (validParams.glyphIntensity == null) {
			validParams.glyphIntensity = 1;
		}
	}

	const version = validParams.version in versions ? versions[validParams.version] : versions.classic;
	const fontName = [validParams.font, version.font, defaults.font].find((name) => name in fonts);
	const font = fonts[fontName];

	const baseTextureURL = textureURLs[[version.baseTexture, defaults.baseTexture].find((name) => name in textureURLs)];
	const hasBaseTexture = baseTextureURL != null;
	const glintTextureURL = textureURLs[[version.glintTexture, defaults.glintTexture].find((name) => name in textureURLs)];
	const hasGlintTexture = glintTextureURL != null;

	const config = {
		...defaults,
		...version,
		...font,
		...validParams,
		baseTextureURL,
		glintTextureURL,
		hasBaseTexture,
		hasGlintTexture,
	};

	if (config.bloomSize <= 0) {
		config.bloomStrength = 0;
	}

	return config;
};
