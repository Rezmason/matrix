const makePassTexture = (regl, halfFloat) =>
	regl.texture({
		width: 1,
		height: 1,
		type: halfFloat ? "half float" : "uint8",
		wrap: "clamp",
		min: "linear",
		mag: "linear",
	});

const makePassFBO = (regl, halfFloat) =>
	regl.framebuffer({ color: makePassTexture(regl, halfFloat) });

const makeDoubleBuffer = (regl, props) => {
	const state = Array(2)
		.fill()
		.map(() =>
			regl.framebuffer({
				color: regl.texture(props),
				depthStencil: false,
			}),
		);
	return {
		front: ({ tick }) => state[tick % 2],
		back: ({ tick }) => state[(tick + 1) % 2],
	};
};

const isPowerOfTwo = (x) => Math.log2(x) % 1 == 0;

const loadImage = (cache, pipelineRegl, url, mipmap) => {
	const key = `${url}_${mipmap}`;
	if (cache.has(key)) {
		return cache.get(key);
	}

	// Cached textures are shared by every pipeline, so they aren't freed with one
	const regl = pipelineRegl.untracked ?? pipelineRegl;
	let texture = regl.texture([[0]]);
	let loaded = false;
	const resource = {
		texture: () => {
			if (!loaded && url != null) {
				console.warn(`texture still loading: ${url}`);
			}
			return texture;
		},
		width: () => {
			if (!loaded && url != null) {
				console.warn(`texture still loading: ${url}`);
			}
			return loaded ? texture.width : 1;
		},
		height: () => {
			if (!loaded && url != null) {
				console.warn(`texture still loading: ${url}`);
			}
			return loaded ? texture.height : 1;
		},
		loaded: (async () => {
			if (url != null) {
				const data = new Image();
				data.crossOrigin = "anonymous";
				let imageURL;
				if (typeof cache.get(`url::${url}`) === "function") {
					imageURL = (await cache.get(`url::${url}`)()).default;
				} else {
					imageURL = url;
				}
				data.src = imageURL;
				await data.decode();
				loaded = true;
				if (mipmap) {
					if (!isPowerOfTwo(data.width) || !isPowerOfTwo(data.height)) {
						console.warn(`Can't mipmap a non-power-of-two image: ${url}`);
					}
					mipmap = false;
				}
				texture = regl.texture({
					data,
					mag: "linear",
					min: mipmap ? "mipmap" : "linear",
					flipY: true,
				});
			}
		})(),
	};
	cache.set(key, resource);
	return resource;
};

const loadText = (cache, url) => {
	const key = url;
	if (cache.has(key)) {
		return cache.get(key);
	}
	let text = "";
	let loaded = false;
	const resource = {
		text: () => {
			if (!loaded) {
				console.warn(`text still loading: ${url}`);
			}
			return text;
		},
		loaded: (async () => {
			if (url != null) {
				if (typeof cache.get(`raw::${url}`) === "function") {
					text = (await cache.get(`raw::${url}`)()).default;
				} else {
					text = await (await fetch(url)).text();
				}
				loaded = true;
			}
		})(),
	};
	cache.set(key, resource);
	return resource;
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
			tick: regl.context("tick"),
		},

		context,

		depth: { enable: false },
	});

const make1DTexture = (regl, rgbas) => {
	const data = rgbas.map((rgba) => rgba.map((f) => Math.floor(f * 0xff))).flat();
	return regl.texture({
		data,
		width: data.length / 4,
		height: 1,
		format: "rgba",
		mag: "linear",
		min: "linear",
	});
};

const makePass = (outputs, ready, setSize, execute) => ({
	outputs: outputs ?? {},
	ready: ready ?? Promise.resolve(),
	setSize: setSize ?? (() => {}),
	execute: execute ?? (() => {}),
});

const resourceTypes = [
	"texture",
	"cube",
	"buffer",
	"elements",
	"renderbuffer",
	"framebuffer",
	"framebufferCube",
];

const isArrayData = (value) => Array.isArray(value) || ArrayBuffer.isView(value);

// Wraps regl so that everything a pipeline allocates can be freed when the
// pipeline is replaced. Inline vertex arrays in draw commands become tracked
// buffers, because the buffers regl makes for them can never be freed.
const trackResources = (regl) => {
	const resources = [];
	const track = (resource) => {
		resources.push(resource);
		return resource;
	};
	const tracked = (options) => {
		if (options?.attributes == null) return regl(options);
		const attributes = Object.fromEntries(
			Object.entries(options.attributes).map(([name, value]) => [
				name,
				isArrayData(value) ? track(regl.buffer(value)) : value,
			]),
		);
		return regl({ ...options, attributes });
	};
	Object.assign(tracked, regl);
	for (const type of resourceTypes) {
		tracked[type] = (...args) => track(regl[type](...args));
	}
	tracked.untracked = regl;
	// Newest first, so framebuffers release their attachments before the
	// textures themselves are destroyed
	tracked.destroyResources = () => {
		for (const resource of resources.splice(0).reverse()) {
			resource.destroy();
		}
	};
	return tracked;
};

const makePipeline = (context, steps) =>
	steps
		.filter((f) => f != null)
		.reduce(
			(pipeline, f, i) => [...pipeline, f(context, i == 0 ? null : pipeline[i - 1].outputs)],
			[],
		);

export {
	makePassTexture,
	makePassFBO,
	makeDoubleBuffer,
	loadImage,
	loadText,
	makeFullScreenQuad,
	make1DTexture,
	makePass,
	makePipeline,
	trackResources,
};
