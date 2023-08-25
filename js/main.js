import { init, load, resize, draw } from "./unraveled.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

const dimensions = { width: 1, height: 1 };

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

const start = async () => {

	const resizeViewport = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * 0.75);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * 0.75);
	};
	window.onresize = resizeViewport;
	resizeViewport();

	const gl = canvas.getContext("webgl");

	const image = new Image();
	image.crossOrigin = "anonymous";
	image.src = "./assets/matrixcode_msdf.png";
	await image.decode();

	const palette = [
		[   0,   0,   0, 255, ],
		[   7,  33,   0, 255, ],
		[  15,  63,   2, 255, ],
		[  22,  96,   5, 255, ],
		[  38, 117,  17, 255, ],
		[  53, 137,  33, 255, ],
		[  71, 160,  48, 255, ],
		[  86, 181,  63, 255, ],
		[ 104, 204,  79, 255, ],
		[ 119, 224,  94, 255, ],
		[ 135, 247, 109, 255, ],
		[ 155, 247, 132, 255, ],
		[ 175, 249, 158, 255, ],
		[ 175, 249, 158, 255, ],
		[ 175, 249, 158, 255, ],
		[ 175, 249, 158, 255, ],
	].flat();

	init(gl);
	load(gl, image, palette);

	let tick = 0;
	const start = Date.now();

	const update = () => {
		tick++;

		if (dimensions.width !== canvas.width || dimensions.height !== canvas.height) {
			dimensions.width = canvas.width;
			dimensions.height = canvas.height;
			resize(gl, dimensions.width, dimensions.height);
		}

		draw(gl, tick, (Date.now() - start) / 1000);
		requestAnimationFrame(update);
	}
	update();

};

document.body.onload = () => {
	start();
};
