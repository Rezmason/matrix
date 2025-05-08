import React, { useEffect, useState, useRef, memo } from "react";
import makeConfig from "./utils/config";

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
	const [rCanvas, setCanvas] = useState(null);
	const [rRenderer, setRenderer] = useState(null);
	const [rRain, setRain] = useState(null);

	const supportsWebGPU = () => {
		return (
			window.GPUQueue != null &&
			navigator.gpu != null &&
			navigator.gpu.getPreferredCanvasFormat != null
		);
	};

	useEffect(() => {
		const useWebGPU = supportsWebGPU() && ["webgpu"].includes(rest.renderer?.toLowerCase());
		const isWebGPU = rRenderer?.type === "webgpu";

		if (rRenderer != null && useWebGPU === isWebGPU) {
			return;
		}

		if (rCanvas != null) {
			matrix.current.removeChild(rCanvas);
			setCanvas(null);
		}

		if (rRain != null) {
			rRenderer?.destroy(rRain);
			setRain(null);
		}

		if (rRenderer != null) {
			setRenderer(null);
		}

		const canvas = document.createElement("canvas");
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		matrix.current.appendChild(canvas);
		setCanvas(canvas);

		const loadRain = async () => {
			const renderer = await import(`./${useWebGPU ? "webgpu" : "regl"}/main.js`);
			setRenderer(renderer);
			const rain = await renderer.init(canvas);
			setRain(rain);
		};
		loadRain();
	}, [props.renderer]);

	useEffect(() => {
		if (rRain == null || rRain.destroyed) {
			return;
		}
		const refresh = async () => {
			await rRenderer.formulate(rRain, makeConfig({ ...rest }));
		};
		refresh();
	}, [props, rRain]);

	return <div ref={matrix} {...elProps}></div>;
});
