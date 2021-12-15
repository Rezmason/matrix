import makeConfig from "./config.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

const supportsWebGPU = async () => {
	return window.GPUQueue != null;
};

document.body.onload = async () => {
	const urlParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
	const config = makeConfig(urlParams);
	const useREGL = !(await supportsWebGPU()) || ["webgl", "regl"].includes(config.renderer?.toLowerCase());
	const solution = import(`./${useREGL ? "regl" : "webgpu"}/main.js`);
	(await solution).default(canvas, config);
};
