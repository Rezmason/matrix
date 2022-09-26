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
};

const textureURLs = {
	sand: "assets/sand.png",
	pixels: "assets/pixel_grid.png",
	mesh: "assets/mesh.png",
	metal: "assets/metal.png",
};

const defaults = {
	font: "matrixcode",
	baseTexture: null, // The name of the texture to apply to the base layer of the glyphs
	glintTexture: null, // The name of the texture to apply to the glint layer of the glyphs
	useCamera: false,
	backgroundColor: [0, 0, 0], // The color "behind" the glyphs
	isolateCursor: true, // Whether the "cursor"— the brightest glyph at the bottom of a raindrop— has its own color
	cursorColor: [1.5, 2, 0.9], // The color of the cursor
	isolateGlint: false, // Whether the "glint"— highlights on certain symbols in the font— should appear
	glintColor: [1, 1, 1], // The color of the glint
	volumetric: false, // A mode where the raindrops appear in perspective
	animationSpeed: 1, // The global rate that all animations progress
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
	paletteEntries: [
		// The color palette that glyph brightness is color mapped to
		{ hsl: [0.3, 0.9, 0.0], at: 0.0 },
		{ hsl: [0.3, 0.9, 0.2], at: 0.2 },
		{ hsl: [0.3, 0.9, 0.7], at: 0.7 },
		{ hsl: [0.3, 0.9, 0.8], at: 0.8 },
	],
	raindropLength: 0.75, // Adjusts the frequency of raindrops (and their length) in a column
	slant: 0, // The angle at which rain falls; the orientation of the glyph grid
	resolution: 0.75, // An overall scale multiplier
	useHalfFloat: false,
	renderer: "regl", // The preferred web graphics API
	isometric: false,
	useHoloplay: false,
	loops: false,
	skipIntro: true,
};

const versions = {
	classic: {},
	megacity: {
		font: "megacity",
		animationSpeed: 0.5,
		width: 40,
	},
	operator: {
		cursorColor: [1.0, 3, 1.5],
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
		paletteEntries: [
			{ hsl: [0.4, 0.8, 0.0], at: 0.0 },
			{ hsl: [0.4, 0.8, 0.5], at: 0.5 },
			{ hsl: [0.4, 0.8, 1.0], at: 1.0 },
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
		paletteEntries: [
			{ hsl: [0.0, 1.0, 0.0], at: 0.0 },
			{ hsl: [0.0, 1.0, 0.2], at: 0.2 },
			{ hsl: [0.0, 1.0, 0.4], at: 0.4 },
			{ hsl: [0.1, 1.0, 0.7], at: 0.7 },
			{ hsl: [0.2, 1.0, 1.0], at: 1.0 },
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
		paletteEntries: [
			{ hsl: [0.0, 0.0, 0.0], at: 0.0 },
			{ hsl: [0.0, 0.8, 0.3], at: 0.3 },
			{ hsl: [0.1, 0.8, 0.5], at: 0.5 },
			{ hsl: [0.1, 1.0, 0.6], at: 0.6 },
			{ hsl: [0.1, 1.0, 0.9], at: 0.9 },
		],
		raindropLength: 0.4,
	},
	resurrections: {
		font: "resurrections",
		glyphEdgeCrop: 0.1,
		cursorColor: [1.4, 2, 1.2],
		baseBrightness: -0.7,
		baseContrast: 1.17,
		highPassThreshold: 0,
		numColumns: 70,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.375, 0.9, 0.0], at: 0.0 },
			{ hsl: [0.375, 1.0, 0.6], at: 0.92 },
			{ hsl: [0.375, 1.0, 1.0], at: 1.0 },
		],
	},
	trinity: {
		font: "resurrections",
		glintTexture: "metal",
		baseTexture: "pixels",
		glyphEdgeCrop: 0.1,
		cursorColor: [1.4, 2, 1.2],
		isolateGlint: true,
		glintColor: [3, 2.5, 0.6],
		glintBrightness: -0.5,
		glintContrast: 1.5,
		baseBrightness: -0.4,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.37, 0.6, 0.0], at: 0.0 },
			{ hsl: [0.37, 0.6, 0.5], at: 1.0 },
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
		cursorColor: [1.4, 2, 1.4],
		isolateGlint: true,
		glintColor: [0, 2, 0.8],
		glintBrightness: -1.5,
		glintContrast: 3,
		baseBrightness: -0.3,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.97, 0.6, 0.0], at: 0.0 },
			{ hsl: [0.97, 0.6, 0.5], at: 1.0 },
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
		cursorColor: [0.6, 1, 2],
		isolateGlint: true,
		glintColor: [0.6, 1.2, 3],
		glintBrightness: -1,
		glintContrast: 3,
		baseBrightness: -0.3,
		baseContrast: 1.5,
		highPassThreshold: 0,
		numColumns: 60,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.12, 0.6, 0.0], at: 0.0 },
			{ hsl: [0.14, 0.6, 0.5], at: 1.0 },
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
		paletteEntries: [
			{ hsl: [0.15, 0.25, 0.9], at: 0.0 },
			{ hsl: [0.6, 0.8, 0.1], at: 0.4 },
		],
	},
	twilight: {
		font: "huberfishD",
		cursorColor: [1.5, 1, 0.9],
		bloomStrength: 0.1,
		numColumns: 50,
		raindropLength: 0.9,
		fallSpeed: 0.1,
		highPassThreshold: 0.0,
		paletteEntries: [
			{ hsl: [0.6, 1.0, 0.05], at: 0.0 },
			{ hsl: [0.6, 0.8, 0.1], at: 0.1 },
			{ hsl: [0.88, 0.8, 0.5], at: 0.5 },
			{ hsl: [0.15, 1.0, 0.6], at: 0.8 },
			// { hsl: [0.1, 1.0, 0.9], at: 1.0 },
		],
	},

	holoplay: {
		font: "resurrections",
		glintTexture: "metal",
		glyphEdgeCrop: 0.1,
		cursorColor: [1.4, 2, 1.2],
		isolateGlint: true,
		glintColor: [3, 2.5, 0.6],
		glintBrightness: -0.5,
		glintContrast: 1.5,
		baseBrightness: -0.4,
		baseContrast: 1.5,
		highPassThreshold: 0,
		cycleSpeed: 0.03,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.37, 0.6, 0.0], at: 0.0 },
			{ hsl: [0.37, 0.6, 0.5], at: 1.0 },
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

const paramMapping = {
	version: { key: "version", parser: (s) => s },
	font: { key: "font", parser: (s) => s },
	effect: { key: "effect", parser: (s) => s },
	camera: { key: "useCamera", parser: (s) => s.toLowerCase().includes("true") },
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
	stripeColors: { key: "stripeColors", parser: (s) => s },
	backgroundColor: { key: "backgroundColor", parser: (s) => s.split(",").map(parseFloat) },
	cursorColor: { key: "cursorColor", parser: (s) => s.split(",").map(parseFloat) },
	glintColor: { key: "glintColor", parser: (s) => s.split(",").map(parseFloat) },
	volumetric: { key: "volumetric", parser: (s) => s.toLowerCase().includes("true") },
	loops: { key: "loops", parser: (s) => s.toLowerCase().includes("true") },
	skipIntro: { key: "skipIntro", parser: (s) => s.toLowerCase().includes("true") },
	renderer: { key: "renderer", parser: (s) => s },
	once: { key: "once", parser: (s) => s.toLowerCase().includes("true") },
	isometric: { key: "isometric", parser: (s) => s.toLowerCase().includes("true") },
};
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
			validParams.cursorColor = [2, 2, 2];
		}

		if (validParams.glintColor == null) {
			validParams.glintColor = [1, 1, 1];
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
