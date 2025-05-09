import { loadImage, loadText, makePassSVG, makePass } from "./utils.js";

const extractEntries = (src, keys) => Object.fromEntries(Array.from(Object.entries(src)).filter(([key]) => keys.includes(key)));

const rippleTypes = {
	box: 0,
	circle: 1,
};

export default ({ artboard, config }) => {
	const { mat2, mat4, vec2, vec3, vec4 } = glMatrix;

	// The volumetric mode multiplies the number of columns
	// to reach the desired density, and then overlaps them
	const volumetric = config.volumetric;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const [numRows, numColumns] = [config.numColumns, Math.floor(config.numColumns * density)];

	// Various effect-related values
	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showDebugView = config.effect === "none";

	const glyphTransform = mat2.fromScaling(mat2.create(), vec2.fromValues(config.glyphFlip ? -1 : 1, 1));
	mat2.rotate(glyphTransform, glyphTransform, (config.glyphRotation * Math.PI) / 180);

	const glyphPositions = Array(numRows)
		.fill()
		.map((_, y) =>
			Array(numColumns)
				.fill()
				.map((_, x) => vec2.fromValues(x, y))
		).flat();

	const glyphs = Array(numRows * numColumns).fill(null);

	// We render the code into an FBO using MSDFs: https://github.com/Chlumsky/msdfgen
	const glyphMSDF = loadImage(config.glyphMSDFURL);
	const glintMSDF = loadImage(config.glintMSDFURL);
	const baseTexture = loadImage(config.baseTextureURL, true);
	const glintTexture = loadImage(config.glintTextureURL, true);
	const output = makePassSVG();

	const raindrop = () => {

		const SQRT_2 = Math.sqrt(2);
		const SQRT_5 = Math.sqrt(5);

		const randomAB = vec2.fromValues(12.9898, 78.233);
		const randomFloat = (uv) => {
			const dt = vec2.dot(uv, randomAB);
			return (Math.sin(dt % Math.PI) * 43758.5453) % 1;
		}

		const wobble = (x) => {
			return x + 0.3 * Math.sin(SQRT_2 * x) + 0.2 * Math.sin(SQRT_5 * x);
		}

		const columnPos = vec2.create();
		const getRainBrightness = (pos) => {
			columnPos[0] = pos[0];
			const columnTime = randomFloat(columnPos) * 1000;
			let rainTime = (pos[1] * 0.01 + columnTime) / config.raindropLength;
			if (!config.loops) {
				rainTime = wobble(rainTime);
			}
			return 1.0 - (rainTime % 1);
		}

		const gridSize = vec2.fromValues(numColumns, numRows);
		const posBelow = vec2.create();
		for (let i = 0; i < glyphPositions.length; i++) {
			const pos = glyphPositions[i];
			vec2.set(posBelow, pos[0], pos[1] - 1);
			const brightness = getRainBrightness(pos);
			const brightnessBelow = getRainBrightness(posBelow);
			const isCursor = brightness > brightnessBelow;
			const symbol = Math.floor(config.glyphSequenceLength * Math.random());
			glyphs[i] = {
				pos, brightness, isCursor, symbol
			};
		}
	};

	const glyphElements = [];

	const render = () => {
		// TODO: rain pass vert, rain pass frag

		for (const {pos, brightness, isCursor, symbol} of glyphs) {
			if (brightness < 0) {
				continue;
			}
			glyphElements.push(`<use fill="#${Math.floor(0xFF * brightness).toString(16)}" href="#sym_${symbol}" transform="translate(${pos[0]},${pos[1]})"></use>`);
		}
		console.log(glyphElements.join("\n"));
	};

	// Camera and transform math for the volumetric mode
	const screenSize = [1, 1];
	const transform = mat4.create();
	if (volumetric && config.isometric) {
		mat4.rotateX(transform, transform, (Math.PI * 1) / 8);
		mat4.rotateY(transform, transform, (Math.PI * 1) / 4);
		mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
		mat4.scale(transform, transform, vec3.fromValues(1, 1, 2));
	} else {
		mat4.translate(transform, transform, vec3.fromValues(0, 0, -1));
	}
	const camera = mat4.create();

	return makePass(
		{
			primary: output,
		},
		Promise.all([
			glyphMSDF.loaded,
			glintMSDF.loaded,
			baseTexture.loaded,
			glintTexture.loaded,
			// rainPassRaindrop.loaded,
			// rainPassSymbol.loaded,
			// rainPassVert.loaded,
			// rainPassFrag.loaded,
		]),
		(w, h) => {
			// output.resize(w, h);
			const aspectRatio = w / h;

			if (volumetric && config.isometric) {
				if (aspectRatio > 1) {
					mat4.ortho(camera, -1.5 * aspectRatio, 1.5 * aspectRatio, -1.5, 1.5, -1000, 1000);
				} else {
					mat4.ortho(camera, -1.5, 1.5, -1.5 / aspectRatio, 1.5 / aspectRatio, -1000, 1000);
				}
			} else {
				mat4.perspective(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
			}
			[screenSize[0], screenSize[1]] = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		},
		(shouldRender) => {
			raindrop();
			render();
		}
	);
};
