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
	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const volumetric = config.volumetric;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const [numRows, numColumns] = [config.numColumns, config.numColumns * density];

	// The volumetric mode requires us to create a grid of quads,
	// rather than a single quad for our geometry
	const [numQuadRows, numQuadColumns] = volumetric ? [numRows, numColumns] : [1, 1];
	const numQuads = numQuadRows * numQuadColumns;
	const quadSize = [1 / numQuadColumns, 1 / numQuadRows];

	// Various effect-related values
	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const cycleStyle = config.cycleStyleName in cycleStyles ? cycleStyles[config.cycleStyleName] : 0;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showComputationTexture = config.effect === "none";

	const commonUniforms = {
		...extractEntries(config, ["animationSpeed", "glyphHeightToWidth", "glyphSequenceLength", "glyphTextureColumns", "resurrectingCodeRatio"]),
		numColumns,
		numRows,
		showComputationTexture,
	};

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
	const rainPassCompute = loadText("shaders/rainPass.compute.frag.glsl");
	const computeUniforms = {
		...commonUniforms,
		...extractEntries(config, [
			"brightnessThreshold",
			"brightnessOverride",
			"brightnessDecay",
			"cursorEffectThreshold",
			"cycleSpeed",
			"cycleFrameSkip",
			"fallSpeed",
			"hasSun",
			"hasThunder",
			"raindropLength",
			"rippleScale",
			"rippleSpeed",
			"rippleThickness",
		]),
		cycleStyle,
		rippleType,
	};
	const compute = regl({
		frag: regl.prop("frag"),
		uniforms: {
			...computeUniforms,
			previousState: doubleBuffer.back,
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
	const msdf = loadImage(regl, config.glyphTexURL);
	const rainPassVert = loadText("shaders/rainPass.vert.glsl");
	const rainPassFrag = loadText("shaders/rainPass.frag.glsl");
	const output = makePassFBO(regl, config.useHalfFloat);
	const renderUniforms = {
		...commonUniforms,
		...extractEntries(config, [
			// vertex
			"forwardSpeed",
			"glyphVerticalSpacing",
			// fragment
			"glyphEdgeCrop",
			"isPolar",
		]),
		density,
		numQuadColumns,
		numQuadRows,
		quadSize,
		slantScale,
		slantVec,
		volumetric,
	};
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
			...renderUniforms,

			state: doubleBuffer.front,
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

	// Camera and transform math for the volumetric mode
	const screenSize = [1, 1];
	const { mat4, vec3 } = glMatrix;
	const camera = mat4.create();
	const translation = vec3.set(vec3.create(), 0, 0, -1);
	const scale = vec3.set(vec3.create(), 1, 1, 1);
	const transform = mat4.create();
	mat4.translate(transform, transform, translation);
	mat4.scale(transform, transform, scale);

	return makePass(
		{
			primary: output,
		},
		() => {
			compute({ frag: rainPassCompute.text() });
			regl.clear({
				depth: 1,
				color: [0, 0, 0, 1],
				framebuffer: output,
			});
			render({ camera, transform, screenSize, vert: rainPassVert.text(), frag: rainPassFrag.text() });
		},
		(w, h) => {
			output.resize(w, h);
			const aspectRatio = w / h;
			glMatrix.mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
			[screenSize[0], screenSize[1]] = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		},
		[msdf.loaded, rainPassCompute.loaded, rainPassVert.loaded, rainPassFrag.loaded]
	);
};
