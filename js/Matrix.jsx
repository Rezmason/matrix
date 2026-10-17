import React, { useEffect, useState, useRef, memo } from "react";
import makeConfig from "./utils/config";
import { resolveConfig, importRenderer } from "./matrixLoader";

/** @typedef {import("../types/index").MatrixProps} MatrixProps */

/** @param {MatrixProps} props */
export const Matrix = memo((props) => {
	const { style, className, ...rawConfigProps } = props;
	const elProps = { style, className };
	const domElement = useRef(null);
	const [rRenderer, setRenderer] = useState(null);
	const rendererRef = useRef(null);
	const [rSize, setSize] = useState([1, 1]);
	const [rConfig, setConfig] = useState(makeConfig({}));

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

	useEffect(() => {
		setConfig(resolveConfig(rawConfigProps));
	}, [props]);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const rendererClass = (await importRenderer(rConfig.renderer)).default;
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
