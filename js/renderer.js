import { loadImage, loadText, makePassFBO, makeDoubleBuffer, makePass } from "./utils.js";

const extractEntries = (src, keys) => Object.fromEntries(Array.from(Object.entries(src)).filter(([key]) => keys.includes(key)));

const rippleTypes = {
	box: 0,
	circle: 1,
};

const cycleStyles = {
	cycleFasterWhenDimmed: 0,
	cycleRandomly: 1,
};

const numVerticesPerQuad = 2 * 3;
const tlVert = [0, 0];
const trVert = [0, 1];
const blVert = [1, 0];
const brVert = [1, 1];
const quadVertices = [tlVert, trVert, brVert, tlVert, brVert, blVert];

export default (regl, config) => {
	const volumetric = config.volumetric;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const [numRows, numColumns] = [config.numColumns, config.numColumns * density];
	const [numQuadRows, numQuadColumns] = volumetric ? [numRows, numColumns] : [1, 1];
	const numQuads = numQuadRows * numQuadColumns;
	const quadSize = [1 / numQuadColumns, 1 / numQuadRows];

	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const cycleStyle = config.cycleStyleName in cycleStyles ? cycleStyles[config.cycleStyleName] : 0;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showComputationTexture = config.effect === "none";

	const uniforms = {
		...extractEntries(config, [
			// rain general
			"glyphHeightToWidth",
			"glyphTextureColumns",
			// rain update
			"animationSpeed",
			"brightnessMinimum",
			"brightnessMix",
			"brightnessMultiplier",
			"brightnessOffset",
			"cursorEffectThreshold",
			"cycleSpeed",
			"fallSpeed",
			"glyphSequenceLength",
			"hasSun",
			"hasThunder",
			"raindropLength",
			"rippleScale",
			"rippleSpeed",
			"rippleThickness",
			"resurrectingCodeRatio",
			// rain render vertex
			"forwardSpeed",
			// rain render fragment
			"glyphEdgeCrop",
			"isPolar",
		]),
		density,
		numRows,
		numColumns,
		numQuadRows,
		numQuadColumns,
		quadSize,
		volumetric,

		rippleType,
		cycleStyle,
		slantVec,
		slantScale,
		showComputationTexture,
	};

	const msdf = loadImage(regl, config.glyphTexURL);

	// These two framebuffers are used to compute the raining code.
	// they take turns being the source and destination of the "compute" shader.
	// The half float data type is crucial! It lets us store almost any real number,
	// whereas the default type limits us to integers between 0 and 255.

	// This double buffer is smaller than the screen, because its pixels correspond
	// with glyphs in the final image, and the glyphs are much larger than a pixel.
	const doubleBuffer = makeDoubleBuffer(regl, {
		width: numColumns,
		height: numRows,
		wrapT: "clamp",
		type: "half float",
	});

	const output = makePassFBO(regl, config.useHalfFloat);

	const updateFrag = loadText("../shaders/update.frag");
	const update = regl({
		frag: regl.prop("frag"),
		uniforms: {
			...uniforms,
			lastState: doubleBuffer.back,
		},

		framebuffer: doubleBuffer.front,
	});

	const quadPositions = Array(numQuadRows)
		.fill()
		.map((_, y) =>
			Array(numQuadColumns)
				.fill()
				.map((_, x) => Array(numVerticesPerQuad).fill([x, y]))
		);

	// We render the code into an FBO using MSDFs: https://github.com/Chlumsky/msdfgen
	const renderVert = loadText("../shaders/render.vert");
	const renderFrag = loadText("../shaders/render.frag");
	const render = regl({
		blend: {
			enable: true,
			func: {
				src: "one",
				dst: "one",
			},
		},
		vert: regl.prop("vert"),
		frag: regl.prop("frag"),

		uniforms: {
			...uniforms,

			lastState: doubleBuffer.front,
			glyphTex: msdf.texture,

			camera: regl.prop("camera"),
			transform: regl.prop("transform"),
			screenSize: regl.prop("screenSize"),
		},

		attributes: {
			aPosition: quadPositions,
			aCorner: Array(numQuads).fill(quadVertices),
		},
		count: numQuads * numVerticesPerQuad,

		framebuffer: output,
	});

	const screenSize = [1, 1];
	const { mat4, vec3 } = glMatrix;
	const camera = mat4.create();
	const translation = vec3.set(vec3.create(), 0, 0.5 / numRows, -1);
	const scale = vec3.set(vec3.create(), 1, 1, 1);
	const transform = mat4.create();
	mat4.translate(transform, transform, translation);
	mat4.scale(transform, transform, scale);

	return makePass(
		{
			primary: output,
		},
		() => {
			update({ frag: updateFrag.text() });
			regl.clear({
				depth: 1,
				color: [0, 0, 0, 1],
				framebuffer: output,
			});
			render({ camera, transform, screenSize, vert: renderVert.text(), frag: renderFrag.text() });
		},
		(w, h) => {
			output.resize(w, h);
			const aspectRatio = w / h;
			glMatrix.mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
			[screenSize[0], screenSize[1]] = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		},
		[msdf.loaded, updateFrag.loaded, renderVert.loaded, renderFrag.loaded]
	);
};
