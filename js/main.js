import makeConfig from "./config.js";
import initWebGPU from "./webgpu/main.js";
import initREGL from "./regl/main.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

document.body.onload = () => {
	const config = makeConfig(window.location.search);
	if (navigator.gpu != null) {
		initWebGPU(canvas, config);
	} else {
		initREGL(canvas, config);
	}
};
