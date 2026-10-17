import makeConfig from "./utils/config";

// Shared by the Matrix component and preload: which renderer and assets a set
// of props needs, and how to load them.

const supportsWebGPU = () => {
	return (
		window.GPUQueue != null &&
		navigator.gpu != null &&
		navigator.gpu.getPreferredCanvasFormat != null
	);
};

// Config for a set of props, falling back to regl where WebGPU isn't available
export const resolveConfig = (configProps) => {
	const config = makeConfig(
		Object.fromEntries(Object.entries(configProps).filter(([_, value]) => value != null)),
	);
	if (config.renderer === "webgpu" && !supportsWebGPU()) {
		config.renderer = "regl";
	}
	return config;
};

export const importRenderer = (type) =>
	type === "webgpu" ? import("./webgpu/renderer.js") : import("./regl/renderer.js");

/**
 * Downloads everything <Matrix> needs for these props (renderer, shaders and
 * textures) ahead of time, so mounting it later doesn't wait on the network.
 * @param {import("./Matrix.jsx").MatrixProps} [props]
 */
export const preload = async (props = {}) => {
	const config = resolveConfig(props);
	const rendererClass = (await importRenderer(config.renderer)).default;
	const { staticAssets } = await rendererClass.libraries;
	const shaders = config.renderer === "webgpu" ? "raw::shaders/wgsl/" : "raw::shaders/glsl/";
	const textures = Object.entries(config)
		.filter(([key, value]) => key.endsWith("URL") && typeof value === "string")
		.map(([_, url]) => `url::${url}`);
	await Promise.all(
		staticAssets
			.filter(([key]) => key.startsWith(shaders) || textures.includes(key))
			.map(([_, load]) => load()),
	);
};
