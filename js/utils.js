const extractEntries = (src, keys) => Object.fromEntries(Array.from(Object.entries(src)).filter(([key]) => keys.includes(key)));

const makePassTexture = (regl, halfFloat) =>
	regl.texture({
		width: 1,
		height: 1,
		type: halfFloat ? "half float" : "uint8",
		wrap: "clamp",
		min: "linear",
		mag: "linear",
	});

const makePassFBO = (regl, halfFloat) => regl.framebuffer({ color: makePassTexture(regl, halfFloat) });

// A pyramid is just an array of FBOs, where each FBO is half the width
// and half the height of the FBO below it.
const makePyramid = (regl, height, halfFloat) =>
	Array(height)
		.fill()
		.map((_) => makePassFBO(regl, halfFloat));

const makeDoubleBuffer = (regl, props) => {
	const state = Array(2)
		.fill()
		.map(() =>
			regl.framebuffer({
				color: regl.texture(props),
				depthStencil: false,
			})
		);
	return {
		front: ({ tick }) => state[tick % 2],
		back: ({ tick }) => state[(tick + 1) % 2],
	};
};

const resizePyramid = (pyramid, vw, vh, scale) =>
	pyramid.forEach((fbo, index) => fbo.resize(Math.floor((vw * scale) / 2 ** index), Math.floor((vh * scale) / 2 ** index)));

const loadImage = (regl, url) => {
	let texture = regl.texture([[0]]);
	let loaded = false;
	return {
		texture: () => {
			if (!loaded) {
				console.warn(`texture still loading: ${url}`);
			}
			return texture;
		},
		loaded: (async () => {
			if (url != null) {
				const data = new Image();
				data.crossOrigin = "anonymous";
				data.src = url;
				await data.decode();
				loaded = true;
				texture = regl.texture({
					data,
					mag: "linear",
					min: "linear",
					flipY: true,
				});
			}
		})(),
	};
};

const loadShader = (regl, url) => {
	let texture = regl.texture([[0]]);
	let loaded = false;
	return {
		texture: () => {
			if (!loaded) {
				console.warn(`texture still loading: ${url}`);
			}
			return texture;
		},
		loaded: (async () => {
			if (url != null) {
				const data = new Image();
				data.crossOrigin = "anonymous";
				data.src = url;
				await data.decode();
				loaded = true;
				texture = regl.texture({
					data,
					mag: "linear",
					min: "linear",
					flipY: true,
				});
			}
		})(),
	};
};

const loadText = (url) => {
	let text = "";
	let loaded = false;
	return {
		text: () => {
			if (!loaded) {
				console.warn(`text still loading: ${url}`);
			}
			return text;
		},
		loaded: (async () => {
			if (url != null) {
				text = await (await fetch(url)).text();
				loaded = true;
			}
		})(),
	};
};

const makeFullScreenQuad = (regl, uniforms = {}, context = {}) =>
	regl({
		vert: `
		precision mediump float;
		attribute vec2 aPosition;
		varying vec2 vUV;
		void main() {
			vUV = 0.5 * (aPosition + 1.0);
			gl_Position = vec4(aPosition, 0, 1);
		}
	`,

		frag: `
		precision mediump float;
		varying vec2 vUV;
		uniform sampler2D tex;
		void main() {
			gl_FragColor = texture2D(tex, vUV);
		}
	`,

		attributes: {
			aPosition: [-4, -4, 4, -4, 0, 4],
		},
		count: 3,

		uniforms: {
			...uniforms,
			time: regl.context("time"),
		},

		context,

		depth: { enable: false },
	});

const make1DTexture = (regl, data) =>
	regl.texture({
		data,
		width: data.length / 3,
		height: 1,
		format: "rgb",
		mag: "linear",
		min: "linear",
	});

const makePass = (outputs, render, resize, ready) => {
	if (render == null) {
		render = () => {};
	}
	if (resize == null) {
		resize = (w, h) => Object.values(outputs).forEach((output) => output.resize(w, h));
	}
	if (ready == null) {
		ready = Promise.resolve();
	} else if (ready instanceof Array) {
		ready = Promise.all(ready);
	}
	return {
		outputs,
		render,
		resize,
		ready,
	};
};

const makePipeline = (steps, getInputs, ...params) =>
	steps.filter((f) => f != null).reduce((pipeline, f, i) => [...pipeline, f(...params, i == 0 ? null : getInputs(pipeline[i - 1]))], []);

export {
	extractEntries,
	makePassTexture,
	makePassFBO,
	makeDoubleBuffer,
	makePyramid,
	resizePyramid,
	loadImage,
	loadText,
	makeFullScreenQuad,
	make1DTexture,
	makePass,
	makePipeline,
};
