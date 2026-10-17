import React, { useEffect, useState, useRef, memo } from "react";
import makeConfig from "./utils/config";

/**
 * @typedef {{space?: "hsl"|"rgb", values: number[]} | number[] | string} Colour
 *   An object, a 3-tuple of 0-1 values, or a string like "1,0,0".
 *   Plain colour props are RGB; use the *HSL props (eg. cursorHSL) for HSL.
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
 *   renderer?: "regl" | "webgpu" | string,
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
 *   slant?: number,                // degrees
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
	const { style, className, ...rawConfigProps } = props;
	const elProps = { style, className };
	const domElement = useRef(null);
	const [rRenderer, setRenderer] = useState(null);
	const rendererRef = useRef(null);
	const [rSize, setSize] = useState([1, 1]);
	const [rConfig, setConfig] = useState(makeConfig({}));
	const rendererModules = {};

	useEffect(() => {
		if (domElement.current == null) return;
		// Created in an effect so the component can render on the server
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const contentBoxSize = entry.contentBoxSize[0];
				setSize([contentBoxSize.inlineSize, contentBoxSize.blockSize]);
				return;
			}
		});
		resizeObserver.observe(domElement.current);
		return () => resizeObserver.disconnect();
	}, [domElement]);

	const supportsWebGPU = () => {
		return (
			window.GPUQueue != null &&
			navigator.gpu != null &&
			navigator.gpu.getPreferredCanvasFormat != null
		);
	};

	useEffect(() => {
		const config = makeConfig({
			...Object.fromEntries(Object.entries(rawConfigProps).filter(([_, value]) => value != null)),
		});
		if (config.renderer === "webgpu" && !supportsWebGPU()) {
			config.renderer = "regl";
		}
		setConfig(config);
	}, [props]);

	useEffect(() => {
		let cancelled = false;
		let rendererModule;
		if (rConfig.renderer === "webgpu") {
			rendererModules.webgpu ??= import("./webgpu/renderer.js");
			rendererModule = rendererModules.webgpu;
		} else {
			rendererModules.regl ??= import("./regl/renderer.js");
			rendererModule = rendererModules.regl;
		}

		(async () => {
			const rendererClass = (await rendererModule).default;
			if (cancelled) return;
			const renderer = new rendererClass();
			await renderer.ready;
			// Unmounted or switched renderers while this one was loading
			if (cancelled) {
				renderer.destroy();
				return;
			}
			rendererRef.current = renderer;
			setRenderer(renderer);
			const canvas = renderer.canvas;
			canvas.style.width = "100%";
			canvas.style.height = "100%";
			domElement.current.appendChild(canvas);
		})();

		// Runs on unmount and before switching renderers. Reads the ref, not
		// rRenderer, because this closure is created before the renderer exists.
		return () => {
			cancelled = true;
			const renderer = rendererRef.current;
			if (renderer == null) return;
			rendererRef.current = null;
			renderer.canvas.remove();
			renderer.destroy();
		};
	}, [rConfig.renderer]);

	useEffect(() => {
		if (rRenderer?.destroyed ?? true) return;
		rRenderer.configure(rConfig);
	}, [rRenderer, rConfig]);

	useEffect(() => {
		if (rRenderer?.destroyed ?? true) return;
		rRenderer.size = rSize.map((n) => n * rConfig.resolution);
	}, [rRenderer, rConfig.resolution, rSize]);

	return <div ref={domElement} {...elProps}></div>;
});
