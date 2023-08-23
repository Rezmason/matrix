import { loadImage, makePassFBO, makeDoubleBuffer, makePass } from "./utils.js";

const numVerticesPerQuad = 2 * 3;
const tlVert = [0, 0];
const trVert = [0, 1];
const blVert = [1, 0];
const brVert = [1, 1];
const quadVertices = [tlVert, trVert, brVert, tlVert, brVert, blVert];

export default ({ regl }) => {
	const size = 80; // The maximum dimension of the glyph grid

	const commonUniforms = {
		glyphSequenceLength: 57,
		glyphTextureGridSize: [8, 8],
		numColumns: size,
		numRows: size,
	};

	const computeDoubleBuffer = makeDoubleBuffer(regl, {
		width: size,
		height: size,
		wrapT: "clamp",
		type: "half float",
	});

	const compute = regl({
		frag: `
			precision highp float;

			#define PI 3.14159265359
			#define SQRT_2 1.4142135623730951
			#define SQRT_5 2.23606797749979

			uniform sampler2D previousComputeState;

			uniform float numColumns, numRows;
			uniform float time, tick;
			uniform float fallSpeed, cycleSpeed;
			uniform float glyphSequenceLength;
			uniform float raindropLength;

			// Helper functions for generating randomness, borrowed from elsewhere

			highp float randomFloat( const in vec2 uv ) {
				const highp float a = 12.9898, b = 78.233, c = 43758.5453;
				highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
				return fract(sin(sn) * c);
			}

			float wobble(float x) {
				return x + 0.3 * sin(SQRT_2 * x) + 0.2 * sin(SQRT_5 * x);
			}

			float getRainBrightness(float simTime, vec2 glyphPos) {
				float columnTimeOffset = randomFloat(vec2(glyphPos.x, 0.)) * 1000.;
				float columnSpeedOffset = randomFloat(vec2(glyphPos.x + 0.1, 0.)) * 0.5 + 0.5;
				float columnTime = columnTimeOffset + simTime * fallSpeed * columnSpeedOffset;
				float rainTime = (glyphPos.y * 0.01 + columnTime) / raindropLength;
				rainTime = wobble(rainTime);
				return 1.0 - fract(rainTime);
			}

			vec2 computeRaindrop(float simTime, vec2 glyphPos) {
				float brightness = getRainBrightness(simTime, glyphPos);
				float brightnessBelow = getRainBrightness(simTime, glyphPos + vec2(0., -1.));
				bool cursor = brightness > brightnessBelow;
				return vec2(brightness, cursor);
			}

			vec2 computeSymbol(float simTime, bool isFirstFrame, vec2 glyphPos, vec2 screenPos, vec4 previous) {

				float previousSymbol = previous.r;
				float previousAge = previous.g;
				bool resetGlyph = isFirstFrame;
				if (resetGlyph) {
					previousAge = randomFloat(screenPos + 0.5);
					previousSymbol = floor(glyphSequenceLength * randomFloat(screenPos));
				}
				float age = previousAge;
				float symbol = previousSymbol;
				if (mod(tick, 1.0) == 0.) {
					age += cycleSpeed;
					if (age >= 1.) {
						symbol = floor(glyphSequenceLength * randomFloat(screenPos + simTime));
						age = fract(age);
					}
				}

				return vec2(symbol, age);
			}

			void main()	{
				vec2 glyphPos = gl_FragCoord.xy;
				vec2 screenPos = glyphPos / vec2(numColumns, numRows);

				vec2 raindrop = computeRaindrop(time, glyphPos);

				bool isFirstFrame = tick <= 1.;
				vec4 previous = texture2D( previousComputeState, screenPos );
				vec4 previousSymbol = vec4(previous.ba, 0.0, 0.0);
				vec2 symbol = computeSymbol(time, isFirstFrame, glyphPos, screenPos, previousSymbol);
				gl_FragColor = vec4(raindrop, symbol);
			}

		`,
		uniforms: {
			...commonUniforms,
			cycleSpeed: 0.03, // The speed glyphs change
			fallSpeed: 0.3, // The speed the raindrops progress downwards
			raindropLength: 0.75, // Adjusts the frequency of raindrops (and their length) in a column
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
	const glyphMSDF = loadImage(regl, "assets/matrixcode_msdf.png");
	const output = makePassFBO(regl);
	const render = regl({
		blend: {
			enable: true,
			func: {
				src: "one",
				dst: "one",
			},
		},
		vert: `
			precision lowp float;

			attribute vec2 aPosition, aCorner;
			uniform vec2 screenSize;
			varying vec2 vUV;

			void main() {
				vUV = aPosition + aCorner;
				gl_Position = vec4((aPosition + aCorner - 0.5) * 2.0 * screenSize, 0.0, 1.0);
			}
		`,
		frag: `
			#define PI 3.14159265359
			#ifdef GL_OES_standard_derivatives
			#extension GL_OES_standard_derivatives: enable
			#endif
			precision lowp float;

			uniform sampler2D computeState;
			uniform float numColumns, numRows;
			uniform sampler2D glyphMSDF;
			uniform float msdfPxRange;
			uniform vec2 glyphMSDFSize;
			uniform float glyphSequenceLength;
			uniform vec2 glyphTextureGridSize;

			varying vec2 vUV;

			float median3(vec3 i) {
				return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
			}

			float modI(float a, float b) {
				float m = a - floor((a + 0.5) / b) * b;
				return floor(m + 0.5);
			}

			vec3 getBrightness(vec2 raindrop, vec2 uv) {

				float base = raindrop.r;
				bool isCursor = bool(raindrop.g);
				float glint = base;

				base = base * 1.1 - 0.5;
				glint = glint * 2.5 - 1.5;

				return vec3(
					(isCursor ? vec2(0.0, 1.0) : vec2(1.0, 0.0)) * base,
					glint
				);
			}

			vec2 getSymbolUV(float index) {
				float symbolX = modI(index, glyphTextureGridSize.x);
				float symbolY = (index - symbolX) / glyphTextureGridSize.x;
				symbolY = glyphTextureGridSize.y - symbolY - 1.;
				return vec2(symbolX, symbolY);
			}

			vec2 getSymbol(vec2 uv, float index) {
				// resolve UV to cropped position of glyph in MSDF texture
				uv = fract(uv * vec2(numColumns, numRows));
				uv = (uv + getSymbolUV(index)) / glyphTextureGridSize;

				// MSDF: calculate brightness of fragment based on distance to shape
				vec2 symbol;
				{
					vec2 unitRange = vec2(msdfPxRange) / glyphMSDFSize;
					vec2 screenTexSize = vec2(1.0) / fwidth(uv);
					float screenPxRange = max(0.5 * dot(unitRange, screenTexSize), 1.0);

					float signedDistance = median3(texture2D(glyphMSDF, uv).rgb);
					float screenPxDistance = screenPxRange * (signedDistance - 0.5);
					symbol.r = clamp(screenPxDistance + 0.5, 0.0, 1.0);
				}

				return symbol;
			}

			void main() {
				vec4 data = texture2D(computeState, vUV);
				vec3 brightness = getBrightness(data.rg, vUV);
				vec2 symbol = getSymbol(vUV, data.b);
				gl_FragColor = vec4(brightness.rg * symbol.r, brightness.b * symbol.g, 0.);
			}
		`,

		uniforms: {
			...commonUniforms,
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
		Promise.all([glyphMSDF.loaded]),
		(w, h) => {
			output.resize(w, h);
			const aspectRatio = w / h;
			[screenSize[0], screenSize[1]] = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		},
		() => {
			compute();
			regl.clear({
				depth: 1,
				color: [0, 0, 0, 1],
				framebuffer: output,
			});
			render({ screenSize });
		}
	);
};
