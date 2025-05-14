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
	const numColumns = config.numColumns;
	const density = volumetric && config.effect !== "none" ? config.density : 1;
	const [numGridRows, numGridColumns] = [config.numColumns, Math.floor(config.numColumns * density)];

	// Various effect-related values
	const rippleType = config.rippleTypeName in rippleTypes ? rippleTypes[config.rippleTypeName] : -1;
	const slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
	const slantScale = 1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
	const showDebugView = config.effect === "none";

	const glyphTransform = mat2.fromScaling(mat2.create(), vec2.fromValues(config.glyphFlip ? -1 : 1, 1));
	mat2.rotate(glyphTransform, glyphTransform, (config.glyphRotation * Math.PI) / 180);

	const glyphPositions = Array(numGridRows)
		.fill()
		.map((_, y) =>
			Array(numGridColumns)
				.fill()
				.map((_, x) => vec2.fromValues(x, y))
		).flat();

	const glyphs = Array(numGridRows * numGridColumns).fill(null);

	// We render the code into an SVG using the imported symbols
	const glyphSVG = loadText(config.glyphSVGURL);
	const baseTexture = loadImage(config.baseTextureURL, true);
	const glintTexture = loadImage(config.glintTextureURL, true);
	const output = makePassSVG();

	const randomAB = vec2.fromValues(12.9898, 78.233);
	const randomFloat = (uv) => {
		const dt = vec2.dot(uv, randomAB);
		return (Math.sin(dt % Math.PI) * 43758.5453) % 1;
	}

	const raindrop = () => {

		const SQRT_2 = Math.sqrt(2);
		const SQRT_5 = Math.sqrt(5);

		const wobble = (x) => {
			return x + 0.3 * Math.sin(SQRT_2 * x) + 0.2 * Math.sin(SQRT_5 * x);
		}

		const columnPos = vec2.create();
		const getRainBrightness = (time, pos) => {
			columnPos[0] = pos[0];
			const columnTimeOffset = randomFloat(columnPos) * 1000;
			columnPos[0] += 0.1;
			let columnSpeedOffset = randomFloat(columnPos) * 0.5 + 0.5;
			if (config.loops) {
				columnSpeedOffset = 0.5;
			}
			const columnTime = columnTimeOffset + time * config.fallSpeed * columnSpeedOffset;
			let rainTime = (pos[1] * 0.01 + columnTime) / config.raindropLength;
			if (!config.loops) {
				rainTime = wobble(rainTime);
			}
			return 1.0 - (rainTime % 1);
		}

		const gridSize = vec2.fromValues(numGridColumns, numGridRows);
		const posBelow = vec2.create();
		const symbolCoord = vec2.create();
		const time = 1 * config.animationSpeed;
		for (let i = 0; i < glyphPositions.length; i++) {
			const pos = glyphPositions[i];
			vec2.set(posBelow, pos[0], pos[1] - 1);
			const brightness = getRainBrightness(time, pos);
			const brightnessBelow = getRainBrightness(time, posBelow);
			const isCursor = brightness > brightnessBelow;

			vec2.divide(symbolCoord, pos, gridSize);
			const symbol = Math.floor(config.glyphSequenceLength * randomFloat(symbolCoord));

			glyphs[i] = {
				pos, brightness, isCursor, symbol
			};
		}
	};

	const glyphElements = [];
	const xmlParser = new DOMParser();

	const render = () => {
		output.setAttribute("viewBox", `0 0 ${numColumns} ${numColumns}`);
		output.setAttribute("preserveAspectRatio", "xMidYMid slice");

		const xml = xmlParser.parseFromString(glyphSVG.text(), "image/svg+xml");
		const defs = xml.querySelector("defs");
		const symbols = [...defs.querySelectorAll("symbol")];
		const symbolsByID = new Map(symbols.map(symbol => (["#" + symbol.id, symbol.innerHTML])));
		const symbolSize = symbols[0].getAttribute("width") || 64;
		const time = 1 * config.animationSpeed;
		// TODO: effect
		// TODO: rain pass frag
		// TODO: move on to next pass

		const randPos = vec2.create();
		const glyphPos = vec2.create();
		const glyphScale = vec2.create();
		const pos4 = vec4.create();
		for (const {pos, brightness, isCursor, symbol} of glyphs) {

			// TODO: use actual thresholds
			if (brightness < 0.6) {
				continue;
			}

			// Calculate the world space position
			let depth = 0.0;
			if (volumetric) {
				vec2.set(randPos, pos[0], 0);
				let startDepth = randomFloat(randPos);
				depth = (startDepth + time * config.animationSpeed * config.forwardSpeed) % 1;
			}

			vec2.set(glyphPos,
				pos[0] * 1 / (numColumns * density),
				pos[1] * config.glyphVerticalSpacing / numColumns
			);
			vec2.set(glyphScale, 1, config.glyphVerticalSpacing);

			if (volumetric) {
				vec2.set(randPos, pos[0], 1);
				glyphPos[1] += randomFloat(randPos);


				vec4.set(pos4,
					(glyphPos[0] - 0.5) * 2,
					(glyphPos[1] - 0.5) * 2,
					depth,
					1
				);
				// pos.x /= glyphHeightToWidth;
				// pos = camera * transform * pos;
				vec4.transformMat4(pos4, pos4, transform);
				vec4.transformMat4(pos4, pos4, camera);
				vec2.set(glyphPos,
					(pos4[0] / pos4[3] / 2) + 0.5,
					(pos4[1] / pos4[3] / 2) + 0.5,
				);
				vec2.scale(glyphScale, glyphScale, 1 / pos4[3]);
				depth = pos4[2];
			}

			glyphPos[0] *= numColumns;
			glyphPos[1] *= numColumns;

			const glyphTransform = `translate(${
				[glyphPos[0], (numColumns - 1) - glyphPos[1]].join(",")
			}) rotate(${
				0
			}) scale(${
				[glyphScale[0] / symbolSize, glyphScale[1] / symbolSize].join(",")
			})`;

			const base = `#sym_${symbol}`;
			const baseBrightness = brightness ** 5;
			const baseChannel = Math.floor(0xFF * baseBrightness);
			const baseColor = "#" + (baseChannel << 8).toString(16).padStart(6, "0");
			const cursorChannel = Math.floor(0xFF * brightness * 0.8);
			const cursorColor = "#" + ((cursorChannel) << 16 | 0xFF << 8 | cursorChannel).toString(16).padStart(6, "0");

			const group = [];

			// group.push(`<rect fill="none" stroke="red" width="64" height="64" />`);
			group.push(`<g fill="${isCursor ? cursorColor : baseColor}">${symbolsByID.get(base)}</g>`);

			const glintBrightness = brightness * 2 - 1;
			const glint = `#sym_${symbol}_glint`;
			if (glintBrightness > 0 && symbolsByID.has(glint)) {
				const glintChannel = Math.floor(0xFF * glintBrightness);
				const glintColor = "#" + (glintChannel << 16 | glintChannel << 8).toString(16).padStart(6, "0");
				group.push(`<g fill="${glintColor}">${symbolsByID.get(glint)}</g>`);
			}

			glyphElements.push([depth, `<g transform="${glyphTransform}">${group.join(" ")}</g>`]);
		}

		glyphElements.sort((p, q) => q[0] - p[0])

		output.innerHTML = [
			`<style>path { mix-blend-mode: screen; }</style>`,
			`<rect width="${numColumns}" height="${numColumns}" />`,
			glyphElements.map(([depth, tag]) => tag).join("\n")
		].join("\n");

		artboard.appendChild(output);
	};

	// Camera and transform math for the volumetric mode
	const screenSize = vec2.fromValues(1, 1);
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
			glyphSVG.loaded,
			baseTexture.loaded,
			glintTexture.loaded,
			// rainPassRaindrop.loaded,
			// rainPassSymbol.loaded,
			// rainPassVert.loaded,
			// rainPassFrag.loaded,
		]),
		(w, h) => {
			output.setAttribute("width", w);
			output.setAttribute("height", h);
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
