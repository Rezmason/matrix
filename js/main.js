import makeConfig from "./config.js";
import './wallpaperEngine.js';

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

const supportsWebGPU = async () => {
	return window.GPUQueue != null && navigator.gpu != null && navigator.gpu.getPreferredCanvasFormat != null;
};

const isRunningSwiftShader = () => {
	const gl = document.createElement("canvas").getContext("webgl");
	const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
	const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
	return renderer.toLowerCase().includes("swiftshader");
};

document.body.onload = async () => {
	const urlParams = new URLSearchParams(window.location.search);
	const config = makeConfig(Object.fromEntries(urlParams.entries()));
	const useWebGPU = (await supportsWebGPU()) && ["webgpu"].includes(config.renderer?.toLowerCase());
	const solution = import(`./${useWebGPU ? "webgpu" : "regl"}/main.js`);

	if (isRunningSwiftShader() && !config.suppressWarnings) {
		const notice = document.createElement("notice");
		notice.innerHTML = `<div class="notice">
		<p>Wake up, Neo... you've got hardware acceleration disabled.</p>
		<p>This project will still run, incredibly, but at a noticeably low framerate.</p>
		<button class="blue pill">Plug me in</button>
		<a class="red pill" target="_blank" href="https://www.google.com/search?q=chrome+enable+hardware+acceleration">Free me</a>
		`;
		canvas.style.display = "none";
		document.body.appendChild(notice);
		document.querySelector(".blue.pill").addEventListener("click", async () => {
			config.suppressWarnings = true;
			urlParams.set("suppressWarnings", true);
			history.replaceState({}, "", "?" + unescape(urlParams.toString()));
			(await solution).default(canvas, config);
			canvas.style.display = "unset";
			document.body.removeChild(notice);
		});
	} else {
		(await solution).default(canvas, config);
	}
};
