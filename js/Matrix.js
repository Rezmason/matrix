import highPassFrag from "../shaders/glsl/bloomPass.highPass.frag.glsl";
import blurFrag from "../shaders/glsl/bloomPass.blur.frag.glsl";
import combineFrag from "../shaders/glsl/bloomPass.combine.frag.glsl";
import imagePassFrag from "../shaders/glsl/imagePass.frag.glsl";
import mirrorPassFrag from "../shaders/glsl/mirrorPass.frag.glsl";
import palettePassFrag from "../shaders/glsl/palettePass.frag.glsl";
import rainPassIntro from "../shaders/glsl/rainPass.intro.frag.glsl";
import rainPassRaindrop from "../shaders/glsl/rainPass.raindrop.frag.glsl";
import rainPassSymbol from "../shaders/glsl/rainPass.symbol.frag.glsl";
import rainPassEffect from "../shaders/glsl/rainPass.effect.frag.glsl";
import rainPassVert from "../shaders/glsl/rainPass.vert.glsl";
import rainPassFrag from "../shaders/glsl/rainPass.frag.glsl";
import stripePassFrag from "../shaders/glsl/stripePass.frag.glsl";
import msdfCoptic from "../assets/coptic_msdf.png";
import msdfGothic from "../assets/gothic_msdf.png";
import msdfMatrixCode from "../assets/matrixcode_msdf.png";
import msdfRes from "../assets/resurrections_msdf.png";
// import megacity from "../assets/megacity_msdf.png";
import msdfResGlint from "../assets/resurrections_glint_msdf.png";
// import msdfHuberfishA from "../assets/huberfish_a_msdf.png";
// import msdfHuberfishD from "../assets/huberfish_d_msdf.png";
// import msdfGtargTenretni from "../assets/gtarg_tenretniolleh_msdf.png";
// import msdfGtargAlienText from "../assets/gtarg_alientext_msdf.png";
// import msdfNeoMatrixology from "../assets/neomatrixology_msdf.png";
// import texSand from "../assets/sand.png";
// import texPixels from "../assets/pixel_grid.png";
import texMesh from "../assets/mesh.png";
import texMetal from "../assets/metal.png";
import bloomBlurShader from "../shaders/wgsl/bloomBlur.wgsl";
import bloomCombineShader from "../shaders/wgsl/bloomCombine.wgsl";
import endPassShader from "../shaders/wgsl/endPass.wgsl";
import imagePassShader from "../shaders/wgsl/imagePass.wgsl";
import mirrorPassShader from "../shaders/wgsl/mirrorPass.wgsl";
import palettePassShader from "../shaders/wgsl/palettePass.wgsl";
import rainPassShader from "../shaders/wgsl/rainPass.wgsl";
import stripePassShader from "../shaders/wgsl/stripePass.wgsl";

const inclusion = [
	highPassFrag,
	blurFrag,
	combineFrag,
	imagePassFrag,
	mirrorPassFrag,
	palettePassFrag,
	rainPassIntro,
	rainPassRaindrop,
	rainPassSymbol,
	rainPassEffect,
	rainPassVert,
	rainPassFrag,
	stripePassFrag,
	msdfCoptic,
	msdfGothic,
	msdfMatrixCode,
	msdfRes,
	// megacity,
	msdfResGlint,
	// msdfHuberfishA,
	// msdfHuberfishD,
	// msdfGtargTenretni,
	// msdfGtargAlienText,
	// msdfNeoMatrixology,
	// texSand,
	// texPixels,
	texMesh,
	texMetal,
	bloomBlurShader,
	bloomCombineShader,
	endPassShader,
	imagePassShader,
	mirrorPassShader,
	palettePassShader,
	rainPassShader,
	stripePassShader,
].reduce((i, s) => s.length + i, 0);
if (inclusion === 0) console.log("!");

import React, { useEffect, useState, useRef, memo } from "react";
import * as reglRenderer from "./regl/main";
import * as webgpuRenderer from "./webgpu/main";
import makeConfig from "./utils/config";

console.log(webgpuRenderer.init, webgpuRenderer.formulate, webgpuRenderer.destroy);

/**
 * @typedef {object} Colour
 * @property {"hsl"|"rgb"} space
 * @property {number[]} values   // 3-tuple [0-1] or [0-360,0-1,0-1]
 */

/**
 * Complete runtime configuration for the Matrix / Digital-Rain component.
 *
 * @typedef {{
 *   /* ------------- core identity ------------- * /
 *   version?: (
 *     "classic" | "megacity" | "neomatrixology" | "operator" |
 *     "nightmare" | "paradise" | "resurrections" | "trinity" |
 *     "morpheus" | "bugs" | "palimpsest" | "twilight" |
 *     "3d" | "throwback" | "updated" |
 *     "1999" | "2003" | "2021" | string            /* custom * /
 *   ),
 *   font?: keyof typeof fonts,                     // "matrixcode", …
 *   effect?: "palette" | "stripe" | string,
 *
 *   /* ------------- texture assets ------------- * /
 *   baseTexture?:  keyof typeof textureURLs | null,
 *   glintTexture?: keyof typeof textureURLs | null,
 *
 *   /* ------------- global toggles ------------- * /
 *   useCamera?: boolean,
 *   volumetric?: boolean,
 *   loops?: boolean,
 *   skipIntro?: boolean,
 *   renderer?: "regl" | "three" | string,
 *   suppressWarnings?: boolean,
 *   useHalfFloat?: boolean,
 *   isometric?: boolean,
 *
 *   /* ------------- glyph appearance ------------- * /
 *   glyphEdgeCrop?: number,
 *   glyphHeightToWidth?: number,
 *   glyphVerticalSpacing?: number,
 *   glyphFlip?: boolean,
 *   glyphRotation?: number,        // radians (multiples of π/2 supported)
 *
 *   /* ------------- cursor & glint ------------- * /
 *   isolateCursor?: boolean,
 *   cursorColor?:   Colour,
 *   cursorIntensity?: number,
 *   isolateGlint?:  boolean,
 *   glintColor?:    Colour,
 *   glintIntensity?: number,
 *
 *   /* ------------- animation & timing ------------- * /
 *   animationSpeed?: number,
 *   fps?: number,
 *   cycleSpeed?: number,
 *   cycleFrameSkip?: number,
 *   fallSpeed?: number,
 *   forwardSpeed?: number,
 *   raindropLength?: number,
 *   slant?: number,                // radians
 *
 *   /* ------------- optical effects ------------- * /
 *   bloomStrength?: number,
 *   bloomSize?: number,
 *   highPassThreshold?: number,
 *   baseBrightness?: number,
 *   baseContrast?: number,
 *   glintBrightness?: number,
 *   glintContrast?: number,
 *   brightnessOverride?: number,
 *   brightnessThreshold?: number,
 *   brightnessDecay?: number,
 *   ditherMagnitude?: number,
 *   hasThunder?: boolean,
 *
 *   /* ------------- geometry ------------- * /
 *   numColumns?: number,
 *   density?: number,
 *   isPolar?: boolean,
 *   rippleTypeName?: ("circle"|"box"|string|null),
 *   rippleThickness?: number,
 *   rippleScale?: number,
 *   rippleSpeed?: number,
 *
 *   /* ------------- colour mapping ------------- * /
 *   palette?: {color: Colour, at: number}[],
 *   stripeColors?: Colour[],
 *   backgroundColor?: Colour,
 *   glyphIntensity?: number,
 *
 *   /* ------------- misc / experimental ------------- * /
 *   resolution?: number,
 *   testFix?: string|null,
 *
 *   /* ------------- React pass-through ------------- * /
 *   style?: React.CSSProperties,
 *   className?: string,
 *
 *   /* ------------- catch-all ------------- * /
 *   [key: string]: unknown
 * }} MatrixProps
 */

/** @param {MatrixProps} props */
export const Matrix = memo((props) => {
	const { style, className, ...rest } = props;
	const elProps = { style, className };
	const matrix = useRef(null);
	const [rain, setRain] = useState(null);

	useEffect(() => {
		const canvas = document.createElement("canvas");
		matrix.current.appendChild(canvas);
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		const init = async () => {
			setRain(await reglRenderer.init(canvas));
		};
		init();

		return () => {
			reglRenderer.destroy(rain);
			setRain(null);
		};
	}, []);

	useEffect(() => {
		if (rain == null) {
			return;
		}
		const refresh = async () => {
			await reglRenderer.formulate(rain, makeConfig({ ...rest }));
		};
		refresh();
	}, [props, rain]);

	return <div ref={matrix} {...elProps}></div>;
});
