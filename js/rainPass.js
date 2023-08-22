import { loadImage, loadText, makePassFBO, makeDoubleBuffer, makePass } from "./utils.js";

const extractEntries = (src, keys) => Object.fromEntries(Array.from(Object.entries(src)).filter(([key]) => keys.includes(key)));

// These compute buffers are used to compute the properties of cells in the grid.
// They take turns being the source and destination of a "compute" shader.
// The half float data type is crucial! It lets us store almost any real number,
// whereas the default type limits us to integers between 0 and 255.

// These double buffers are smaller than the screen, because their pixels correspond
// with cells in the grid, and the cells' glyphs are much larger than a pixel.
const makeComputeDoubleBuffer = (regl, height, width) =>
	makeDoubleBuffer(regl, {
		width,
		height,
		wrapT: "clamp",
		type: "half float",
	});

const numVerticesPerQuad = 2 * 3;
const tlVert = [0, 0];
const trVert = [0, 1];
const blVert = [1, 0];
const brVert = [1, 1];
const quadVertices = [tlVert, trVert, brVert, tlVert, brVert, blVert];

export default ({ regl, config }) => {
	const [numRows, numColumns] = [config.numColumns, config.numColumns];

	const commonUniforms = {
		...extractEntries(config, ["animationSpeed", "glyphHeightToWidth", "glyphSequenceLength", "glyphTextureGridSize"]),
		numColumns,
		numRows,
	};

	const computeDoubleBuffer = makeComputeDoubleBuffer(regl, numRows, numColumns);
	const rainPassCompute = loadText("shaders/glsl/rainPass.compute.frag.glsl");
	const computeUniforms = {
		...commonUniforms,
		...extractEntries(config, ["fallSpeed", "raindropLength"]),
		...extractEntries(config, ["cycleSpeed", "cycleFrameSkip"]),
	};
	const compute = regl({
		frag: regl.prop("frag"),
		uniforms: {
			...computeUniforms,
			previousComputeState: computeDoubleBuffer.back,
		},

		framebuffer: computeDoubleBuffer.front,
	});

	const quadPositions = Array(1)
		.fill()
		.map((_, y) =>
			Array(1)
				.fill()
				.map((_, x) => Array(numVerticesPerQuad).fill([x, y]))
		);

	// We render the code into an FBO using MSDFs: https://github.com/Chlumsky/msdfgen
	const glyphMSDF = loadImage(regl, config.glyphMSDFURL);
	const rainPassVert = loadText("shaders/glsl/rainPass.vert.glsl");
	const rainPassFrag = loadText("shaders/glsl/rainPass.frag.glsl");
	const output = makePassFBO(regl, config.useHalfFloat);
	const renderUniforms = {
		...commonUniforms,
		...extractEntries(config, [
			// vertex
			"forwardSpeed",
			"glyphVerticalSpacing",
			// fragment
			"baseBrightness",
			"baseContrast",
			"glintBrightness",
			"glintContrast",
			"brightnessThreshold",
			"brightnessOverride",
			"isolateCursor",
			"glyphEdgeCrop",
		]),
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

			computeState: computeDoubleBuffer.front,
			glyphMSDF: glyphMSDF.texture,

			msdfPxRange: 4.0,
			glyphMSDFSize: () => [glyphMSDF.width(), glyphMSDF.height()],

			screenSize: regl.prop("screenSize"),
		},

		attributes: {
			aPosition: quadPositions,
			aCorner: quadVertices,
		},
		count: numVerticesPerQuad,

		framebuffer: output,
	});

	const screenSize = [1, 1];

	return makePass(
		{
			primary: output,
		},
		Promise.all([
			glyphMSDF.loaded,
			rainPassCompute.loaded,
			rainPassVert.loaded,
			rainPassFrag.loaded,
		]),
		(w, h) => {
			output.resize(w, h);
			const aspectRatio = w / h;
			[screenSize[0], screenSize[1]] = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		},
		(shouldRender) => {
			compute({ frag: rainPassCompute.text() });

			if (shouldRender) {
				regl.clear({
					depth: 1,
					color: [0, 0, 0, 1],
					framebuffer: output,
				});

				render({ screenSize, vert: rainPassVert.text(), frag: rainPassFrag.text() });
			}
		}
	);
};
