import type { CSSProperties, NamedExoticComponent } from "react";

/** Preset looks. Each one is a starting point that the other props override. */
export type MatrixVersion =
	| "classic"
	| "megacity"
	| "neomatrixology"
	| "operator"
	| "nightmare"
	| "paradise"
	| "resurrections"
	| "trinity"
	| "morpheus"
	| "bugs"
	| "palimpsest"
	| "twilight"
	| "3d"
	| "throwback"
	| "updated"
	| "1999"
	| "2003"
	| "2021";

/** Glyph sets */
export type MatrixFont =
	| "matrixcode"
	| "megacity"
	| "resurrections"
	| "neomatrixology"
	| "coptic"
	| "gothic"
	| "huberfishA"
	| "huberfishD"
	| "gtarg_tenretniolleh"
	| "gtarg_alientext";

/** The final pass, which mainly decides how the rain is colored */
export type MatrixEffect =
	| "none"
	| "plain"
	| "palette"
	| "customStripes"
	| "stripes"
	| "pride"
	| "transPride"
	| "trans"
	| "image"
	| "mirror";

/** Textures that can be applied to the glyphs */
export type MatrixTexture = "sand" | "pixels" | "mesh" | "metal";

/**
 * A color: `[r, g, b]` with 0-1 values, a string like `"1,0,0"`, or
 * `{ space: "hsl", values: [h, s, l] }`. Plain color props read numbers and
 * strings as RGB; their *HSL twins (eg. `cursorHSL`) read them as HSL.
 */
export type MatrixColor =
	| [number, number, number]
	| number[]
	| string
	| { space?: "rgb" | "hsl"; values: number[] };

/** A palette stop: the color glyphs of brightness `at` (0-1) are mapped to */
export interface MatrixPaletteStop {
	color: MatrixColor;
	at: number;
}

/**
 * Every prop is optional and can change while the component is mounted.
 * Unset props come from `version`, and then from the defaults.
 */
export interface MatrixProps {
	/** Preset look. Default `"classic"`. */
	version?: MatrixVersion;
	font?: MatrixFont;
	/** Default `"palette"` */
	effect?: MatrixEffect;
	/** Background image for the `"image"` effect */
	url?: string;
	baseTexture?: MatrixTexture | null;
	glintTexture?: MatrixTexture | null;

	/** Preferred graphics API. `"webgpu"` falls back to `"regl"` (WebGL) where unsupported. Default `"regl"`. */
	renderer?: "regl" | "webgpu";
	/** Render resolution as a fraction of the element's size. Default `0.75`. */
	resolution?: number;
	/** Target frame rate, up to 60. Default `60`. */
	fps?: number;
	/** Render a single frame */
	once?: boolean;
	useHalfFloat?: boolean;
	suppressWarnings?: boolean;
	/** Default `true` */
	skipIntro?: boolean;
	loops?: boolean;
	/** Use the webcam (for the `"mirror"` effect). Asks the visitor for permission. */
	camera?: boolean;
	/** Same as `camera` */
	useCamera?: boolean;

	/** The maximum dimension of the glyph grid. Default `80`. */
	numColumns?: number;
	/** Raindrops appear in perspective, approaching the viewer */
	volumetric?: boolean;
	isometric?: boolean;
	/** In volumetric mode, the number of columns compared to the grid. Default `1`. */
	density?: number;
	/** Glyphs arc across the screen instead of sitting in a grid */
	isPolar?: boolean;
	/** The angle the rain falls at, in degrees. Default `0`. */
	slant?: number;

	/** The global rate all animations progress at. Default `1`. */
	animationSpeed?: number;
	/** How fast raindrops fall. Default `0.3`. */
	fallSpeed?: number;
	/** How fast volumetric rain approaches the viewer. Default `0.25`. */
	forwardSpeed?: number;
	/** How fast glyphs change. Default `0.03`. */
	cycleSpeed?: number;
	/** Minimum frames between glyph changes. Default `1`. */
	cycleFrameSkip?: number;
	/** Raindrop frequency and length. Default `0.75`. */
	raindropLength?: number;

	glyphEdgeCrop?: number;
	glyphHeightToWidth?: number;
	glyphVerticalSpacing?: number;
	/** Mirror the glyphs horizontally */
	glyphFlip?: boolean;
	/** Glyph rotation in degrees, in 90° steps */
	glyphRotation?: number;

	/** Give the brightest glyph of each raindrop its own color. Default `true`. */
	isolateCursor?: boolean;
	cursorColor?: MatrixColor;
	cursorHSL?: MatrixColor;
	/** Default `2` */
	cursorIntensity?: number;
	/** Show highlights on the glyphs that have them */
	isolateGlint?: boolean;
	glintColor?: MatrixColor;
	glintHSL?: MatrixColor;
	glintIntensity?: number;
	glintBrightness?: number;
	glintContrast?: number;
	backgroundColor?: MatrixColor;
	backgroundHSL?: MatrixColor;
	/** Brightness is mapped onto these colors (`"palette"` effect). Also accepts a flat `"r,g,b,at,…"` string. */
	palette?: MatrixPaletteStop[] | number[] | string;
	paletteHSL?: MatrixPaletteStop[] | number[] | string;
	/** Colors for the `"stripes"` effect. Also accepts a flat `"r,g,b,…"` string. */
	stripeColors?: MatrixColor[] | number[] | string;
	stripeHSL?: MatrixColor[] | number[] | string;

	/** 0-1. Default `0.7`. */
	bloomStrength?: number;
	/** 0-1; 0 turns bloom off. Default `0.4`. */
	bloomSize?: number;
	highPassThreshold?: number;
	baseBrightness?: number;
	baseContrast?: number;
	/** Overrides the brightness of every glyph when above 0 */
	brightnessOverride?: number;
	brightnessThreshold?: number;
	brightnessDecay?: number;
	/** 0-1. Default `0.05`. */
	ditherMagnitude?: number;
	/** Lightning flashes */
	hasThunder?: boolean;
	rippleTypeName?: "box" | "circle" | null;
	rippleThickness?: number;
	rippleScale?: number;
	rippleSpeed?: number;

	/** Applied to the wrapper element, which the canvas fills */
	style?: CSSProperties;
	className?: string;
}

/**
 * Full-size digital rain. The renderer, shaders and textures load on demand
 * the first time a config needs them (see `preload`).
 */
export declare const Matrix: NamedExoticComponent<MatrixProps>;

/**
 * Downloads everything `<Matrix {...props} />` needs (renderer, shaders and
 * textures) ahead of time, so mounting it later doesn't wait on the network.
 */
export declare function preload(props?: MatrixProps): Promise<void>;
