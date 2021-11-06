import makeConfig from "./config.js";
import initWebGPU from "./webgpu/main.js";
import initREGL from "./regl/main.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

document.body.onload = () => {
	const urlParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
	const config = makeConfig(urlParams);
	if (navigator.gpu == null || ["webgl", "regl"].includes(urlParams.renderer?.toLowerCase())) {
		initREGL(canvas, config);
	} else {
		initWebGPU(canvas, config);
	}
};
