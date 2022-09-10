const fonts = {
	coptic: {
		// The script the Gnostic codices were written in
		glyphTexURL: "assets/coptic_msdf.png",
		glyphSequenceLength: 32,
		glyphTextureGridSize: [8, 8],
	},
	gothic: {
		// The script the Codex Argenteus was written in
		glyphTexURL: "assets/gothic_msdf.png",
		glyphSequenceLength: 27,
		glyphTextureGridSize: [8, 8],
	},
	matrixcode: {
		// The glyphs seen in the film trilogy
		glyphTexURL: "assets/matrixcode_msdf.png",
		glyphSequenceLength: 57,
		glyphTextureGridSize: [8, 8],
	},
	megacity: {
		// The glyphs seen in the film trilogy
		glyphTexURL: "assets/megacity_msdf.png",
		glyphSequenceLength: 64,
		glyphTextureGridSize: [8, 8],
	},
	resurrections: {
		// The glyphs seen in the film trilogy
		glyphTexURL: "assets/resurrections_msdf.png",
		glyphSequenceLength: 135,
		glyphTextureGridSize: [13, 12],
	},
	huberfishA: {
		glyphTexURL: "assets/huberfish_a_msdf.png",
		glyphSequenceLength: 34,
		glyphTextureGridSize: [6, 6],
	},
	huberfishD: {
		glyphTexURL: "assets/huberfish_d_msdf.png",
		glyphSequenceLength: 34,
		glyphTextureGridSize: [6, 6],
	},
	gtarg_tenretniolleh: {
		glyphTexURL: "assets/gtarg_tenretniolleh_msdf.png",
		glyphSequenceLength: 36,
		glyphTextureGridSize: [6, 6],
	},
	gtarg_alientext: {
		glyphTexURL: "assets/gtarg_alientext_msdf.png",
		glyphSequenceLength: 38,
		glyphTextureGridSize: [8, 5],
	},
};

const defaults = {
	font: "matrixcode",
	useCamera: false,
	backgroundColor: [0, 0, 0], // The color "behind" the glyphs
	cursorBrightness: 0, // The brightness of the "cursor" at the bottom of a raindrop
	volumetric: false, // A mode where the raindrops appear in perspective
	animationSpeed: 1, // The global rate that all animations progress
	forwardSpeed: 0.25, // The speed volumetric rain approaches the eye
	bloomStrength: 0.7, // The intensity of the bloom
	bloomSize: 0.4, // The amount the bloom calculation is scaled
	highPassThreshold: 0.1, // The minimum brightness that is still blurred
	cycleSpeed: 0.4, // The speed glyphs change
	cycleFrameSkip: 1, // The global minimum number of frames between glyphs cycling
	cycleStyleName: "cycleFasterWhenDimmed", // The way glyphs cycle, either proportional to their brightness or randomly
	baseBrightness: -0.5, // The brightness of the glyphs, before any effects are applied
	baseContrast: 1.1, // The contrast of the glyphs, before any effects are applied
	brightnessOverride: 0.0, // A global override to the brightness of displayed glyphs. Only used if it is > 0.
	brightnessThreshold: 0, // The minimum brightness for a glyph to still be considered visible
	brightnessDecay: 1.0, // The rate at which glyphs light up and dim
	ditherMagnitude: 0.05, // The magnitude of the random per-pixel dimming
	fallSpeed: 0.3, // The speed the raindrops progress downwards
	glyphEdgeCrop: 0.0, // The border around a glyph in a font texture that should be cropped out
	glyphHeightToWidth: 1, // The aspect ratio of glyphs
	glyphVerticalSpacing: 1, // The ratio of the vertical distance between glyphs to their height
	hasSun: false, // Makes the glyphs more radiant. Admittedly not very technical.
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
	renderer: "webgpu", // The preferred web graphics API
	isometric: false,
	useHoloplay: false,
	loops: false,
};

const versions = {
	classic: {},
	megacity: {
		font: "megacity",
		animationSpeed: 0.5,
		width: 40,
	},
	operator: {
		cursorBrightness: 1,
		bloomSize: 0.6,
		bloomStrength: 0.75,
		highPassThreshold: 0.0,
		cycleSpeed: 0.01,
		cycleFrameSkip: 8,
		cycleStyleName: "cycleRandomly",
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
		bloomStrength: 1,
		highPassThreshold: 0,
		cycleSpeed: 0.05,
		baseBrightness: -0.1,
		brightnessDecay: 0.05,
		fallSpeed: 0.04,
		hasSun: true,
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
		cursorBrightness: 1,
		baseBrightness: -0.7,
		baseContrast: 1.17,
		highPassThreshold: 0,
		numColumns: 70,
		cycleStyleName: "cycleRandomly",
		cycleSpeed: 0.05,
		bloomStrength: 0.7,
		fallSpeed: 0.3,
		paletteEntries: [
			{ hsl: [0.38, 0.9, 0.0], at: 0.0 },
			{ hsl: [0.38, 1.0, 0.6], at: 0.92 },
			{ hsl: [0.38, 1.0, 1.0], at: 1.0 },
		],
	},
	palimpsest: {
		font: "huberfishA",
		bloomStrength: 0.2,
		numColumns: 40,
		raindropLength: 1.2,
		cycleFrameSkip: 3,
		fallSpeed: 0.5,
		cycleStyleName: "cycleRandomly",
		slant: Math.PI * -0.0625,
		paletteEntries: [
			{ hsl: [0.15, 0.25, 0.9], at: 0.0 },
			{ hsl: [0.6, 0.8, 0.1], at: 0.4 },
		],
	},
	twilight: {
		font: "huberfishD",
		bloomStrength: 0.3,
		numColumns: 50,
		raindropLength: 0.9,
		fallSpeed: 0.1,
		cycleStyleName: "cycleRandomly",
		highPassThreshold: 0.0,
		hasSun: true,
		paletteEntries: [
			{ hsl: [0.6, 1.0, 0.05], at: 0.0 },
			{ hsl: [0.6, 0.8, 0.1], at: 0.1 },
			{ hsl: [0.88, 0.8, 0.5], at: 0.5 },
			{ hsl: [0.15, 1.0, 0.6], at: 0.8 },
			{ hsl: [0.1, 1.0, 0.9], at: 1.0 },
		],
	},

	holoplay: {
		font: "resurrections",
		numColumns: 20,
		fallSpeed: 0.35,
		cycleStyleName: "cycleRandomly",
		cycleSpeed: 0.3,
		glyphEdgeCrop: 0.1,
		ditherMagnitude: 0,
		paletteEntries: [
			{ hsl: [0.39, 0.9, 0.0], at: 0.0 },
			{ hsl: [0.39, 1.0, 0.6], at: 0.5 },
			{ hsl: [0.39, 1.0, 1.0], at: 1.0 },
		],
		raindropLength: 1.4,
		highPassThreshold: 0.2,

		renderer: "regl",
		bloomStrength: 0,
		volumetric: true,
		forwardSpeed: 0,
		density: 3,
		useHoloplay: true,
	},

	["3d"]: {
		volumetric: true,
		fallSpeed: 0.5,
		cycleSpeed: 0.35,
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
	volumetric: { key: "volumetric", parser: (s) => s.toLowerCase().includes("true") },
	loops: { key: "loops", parser: (s) => s.toLowerCase().includes("true") },
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

	const version = validParams.version in versions ? versions[validParams.version] : versions.classic;
	const fontName = [validParams.font, version.font, defaults.font].find((name) => name in fonts);
	const font = fonts[fontName];

	const config = {
		...defaults,
		...version,
		...font,
		...validParams,
	};

	if (config.bloomSize <= 0) {
		config.bloomStrength = 0;
	}

	return config;
};
