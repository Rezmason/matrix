import makeConfig from "./config.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

const supportsWebGPU = async () => {
	return window.GPUQueue != null && navigator.gpu != null && navigator.gpu.getPreferredCanvasFormat != null;
};

document.body.onload = async () => {
	const urlParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
	const config = makeConfig(urlParams);
	const useWebGPU = (await supportsWebGPU()) && ["webgpu"].includes(config.renderer?.toLowerCase());
	const solution = import(`./${useWebGPU ? "webgpu" : "regl"}/main.js`);
	(await solution).default(canvas, config);
};
