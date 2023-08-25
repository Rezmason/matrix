const extendedContext = {};
const state = {};
const textures = {};
const textureSizes = { fullscreen: {scale: 1}};

const extensionNames = [
	"oes_texture_half_float",
	"oes_texture_half_float_linear",
	"ext_color_buffer_half_float",
	"webgl_color_buffer_float",
	"oes_standard_derivatives",
];

const fullscreen_frag_shader_source = `
	precision mediump float;
	varying vec2 vUV;
	uniform sampler2D tex;
	void main() {
		gl_FragColor = texture2D(tex, vUV);
	}
`;

const fullscreen_vert_shader_source = `
	precision mediump float;
	attribute vec2 aPosition;
	varying vec2 vUV;
	void main() {
		vUV = 0.5 * (aPosition + 1.0);
		gl_Position = vec4(aPosition, 0, 1);
	}
`;

const rain_compute_shader_source = `
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

`;

const rain_vert_shader_source = `
	precision lowp float;

	attribute vec2 aPosition;
	uniform vec2 screenSize;
	varying vec2 vUV;

	void main() {
		vUV = aPosition;
		gl_Position = vec4((aPosition - 0.5) * 2.0 * screenSize, 0.0, 1.0);
	}
`;

const rain_frag_shader_source = `
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
		uv = fract(uv * vec2(numColumns, numRows));
		uv = (uv + getSymbolUV(index)) / glyphTextureGridSize;

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
`;

const bloom_high_pass_shader_source = `
	precision mediump float;

	uniform sampler2D tex;
	uniform float highPassThreshold;

	varying vec2 vUV;

	void main() {
		vec4 color = texture2D(tex, vUV);

		if (color.r < highPassThreshold) color.r = 0.0;
		if (color.g < highPassThreshold) color.g = 0.0;
		if (color.b < highPassThreshold) color.b = 0.0;
		gl_FragColor = color;
	}
`;

const bloom_blur_shader_source = `
	precision mediump float;

	uniform float width, height;
	uniform sampler2D tex;
	uniform vec2 direction;

	varying vec2 vUV;

	void main() {
		vec2 size = height > width ? vec2(height / width, 1.) : vec2(1., width / height);
		gl_FragColor =
			texture2D(tex, vUV) * 0.442 +
			(
				texture2D(tex, vUV + direction / max(height, width) * size) +
				texture2D(tex, vUV - direction / max(height, width) * size)
			) * 0.279;
	}
`;

const bloom_combine_shader_source = `
	precision mediump float;

	uniform sampler2D pyr_0, pyr_1, pyr_2, pyr_3, pyr_4;
	uniform float bloomStrength;
	varying vec2 vUV;

	void main() {
		vec4 total = vec4(0.);
		total += texture2D(pyr_0, vUV) * 0.96549;
		total += texture2D(pyr_1, vUV) * 0.92832;
		total += texture2D(pyr_2, vUV) * 0.88790;
		total += texture2D(pyr_3, vUV) * 0.84343;
		total += texture2D(pyr_4, vUV) * 0.79370;
		gl_FragColor = total * bloomStrength;
	}
`;

const palette_shader_source = `
	precision mediump float;
	#define PI 3.14159265359

	uniform sampler2D tex, bloomTex, paletteTex;
	uniform float time;
	varying vec2 vUV;

	highp float rand( const in vec2 uv, const in float t ) {
		const highp float a = 12.9898, b = 78.233, c = 43758.5453;
		highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
		return fract(sin(sn) * c + t);
	}

	void main() {
		vec4 primary = texture2D(tex, vUV);
		vec4 bloom = texture2D(bloomTex, vUV);
		vec4 brightness = primary + bloom - rand( gl_FragCoord.xy, time ) * 0.0167;
		gl_FragColor = vec4(
			texture2D( paletteTex, vec2(brightness.r, 0.0)).rgb
				+ min(vec3(0.756, 1.0, 0.46) * brightness.g * 2.0, vec3(1.0)),
			1.0
		);
	}
`;

const init = (gl) => Object.assign(extendedContext, ...extensionNames.map(name => Object.getPrototypeOf(gl.getExtension(name))));

const load = (gl, msdfImage, palette) => {

	state.fullscreen_frag_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.fullscreen_frag_shader, fullscreen_frag_shader_source); gl.compileShader(state.fullscreen_frag_shader);

	state.fullscreen_vert_shader = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(state.fullscreen_vert_shader, fullscreen_vert_shader_source); gl.compileShader(state.fullscreen_vert_shader);

	state.rain_compute_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.rain_compute_shader, rain_compute_shader_source); gl.compileShader(state.rain_compute_shader);

	state.rain_frag_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.rain_frag_shader, rain_frag_shader_source); gl.compileShader(state.rain_frag_shader);

	state.rain_vert_shader = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(state.rain_vert_shader, rain_vert_shader_source); gl.compileShader(state.rain_vert_shader);

	state.bloom_high_pass_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.bloom_high_pass_shader, bloom_high_pass_shader_source); gl.compileShader(state.bloom_high_pass_shader);

	state.bloom_blur_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.bloom_blur_shader, bloom_blur_shader_source); gl.compileShader(state.bloom_blur_shader);

	state.bloom_combine_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.bloom_combine_shader, bloom_combine_shader_source); gl.compileShader(state.bloom_combine_shader);

	state.palette_shader = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(state.palette_shader, palette_shader_source); gl.compileShader(state.palette_shader);

	state.fullscreen_program = gl.createProgram(); gl.attachShader(state.fullscreen_program, state.fullscreen_vert_shader); gl.attachShader(state.fullscreen_program, state.fullscreen_frag_shader); gl.linkProgram(state.fullscreen_program);
	state.rain_program_u_tex = gl.getUniformLocation(state.fullscreen_program, "tex");
	state.fullscreen_program_a_aPosition = gl.getAttribLocation(state.fullscreen_program, "aPosition");

	state.rain_compute_program = gl.createProgram(); gl.attachShader(state.rain_compute_program, state.fullscreen_vert_shader); gl.attachShader(state.rain_compute_program, state.rain_compute_shader); gl.linkProgram(state.rain_compute_program);
	state.rain_compute_program_a_aPosition = gl.getAttribLocation(state.rain_compute_program, "aPosition");
	state.rain_compute_program_u_numColumns = gl.getUniformLocation(state.rain_compute_program, "numColumns");
	state.rain_compute_program_u_glyphSequenceLength = gl.getUniformLocation(state.rain_compute_program, "glyphSequenceLength");
	state.rain_compute_program_u_numRows = gl.getUniformLocation(state.rain_compute_program, "numRows");
	state.rain_compute_program_u_fallSpeed = gl.getUniformLocation(state.rain_compute_program, "fallSpeed");
	state.rain_compute_program_u_time = gl.getUniformLocation(state.rain_compute_program, "time");
	state.rain_compute_program_u_raindropLength = gl.getUniformLocation(state.rain_compute_program, "raindropLength");
	state.rain_compute_program_u_previousComputeState = gl.getUniformLocation(state.rain_compute_program, "previousComputeState");
	state.rain_compute_program_u_tick = gl.getUniformLocation(state.rain_compute_program, "tick");
	state.rain_compute_program_u_cycleSpeed = gl.getUniformLocation(state.rain_compute_program, "cycleSpeed");

	gl.useProgram(state.rain_compute_program);
	gl.uniform1f(state.rain_compute_program_u_numColumns, 80);
	gl.uniform1f(state.rain_compute_program_u_glyphSequenceLength, 57);
	gl.uniform1f(state.rain_compute_program_u_numRows, 80);
	gl.uniform1f(state.rain_compute_program_u_fallSpeed, 0.3);
	gl.uniform1f(state.rain_compute_program_u_raindropLength, 0.75);
	gl.uniform1f(state.rain_compute_program_u_cycleSpeed, 0.03);

	state.rain_program = gl.createProgram(); gl.attachShader(state.rain_program, state.rain_vert_shader); gl.attachShader(state.rain_program, state.rain_frag_shader); gl.linkProgram(state.rain_program);
	state.rain_program_a_aPosition = gl.getAttribLocation(state.rain_program, "aPosition");
	state.rain_program_u_glyphTextureGridSize = gl.getUniformLocation(state.rain_program, "glyphTextureGridSize");
	state.rain_program_u_numColumns = gl.getUniformLocation(state.rain_program, "numColumns");
	state.rain_program_u_glyphMSDFSize = gl.getUniformLocation(state.rain_program, "glyphMSDFSize");
	state.rain_program_u_numRows = gl.getUniformLocation(state.rain_program, "numRows");
	state.rain_program_u_msdfPxRange = gl.getUniformLocation(state.rain_program, "msdfPxRange");
	state.rain_program_u_screenSize = gl.getUniformLocation(state.rain_program, "screenSize");
	state.rain_program_u_computeState = gl.getUniformLocation(state.rain_program, "computeState");
	state.rain_program_u_glyphMSDF = gl.getUniformLocation(state.rain_program, "glyphMSDF");

	gl.useProgram(state.rain_program);
	gl.uniform2f(state.rain_program_u_glyphTextureGridSize, 8, 8);
	gl.uniform1f(state.rain_program_u_numColumns, 80);
	gl.uniform2f(state.rain_program_u_glyphMSDFSize, 512, 512);
	gl.uniform1f(state.rain_program_u_numRows, 80);
	gl.uniform1f(state.rain_program_u_msdfPxRange, 4);

	state.bloom_high_pass_program = gl.createProgram(); gl.attachShader(state.bloom_high_pass_program, state.fullscreen_vert_shader); gl.attachShader(state.bloom_high_pass_program, state.bloom_high_pass_shader); gl.linkProgram(state.bloom_high_pass_program);
	state.bloom_high_pass_program_a_aPosition = gl.getAttribLocation(state.bloom_high_pass_program, "aPosition");
	state.bloom_high_pass_program_u_tex = gl.getUniformLocation(state.bloom_high_pass_program, "tex");
	state.bloom_high_pass_program_u_highPassThreshold = gl.getUniformLocation(state.bloom_high_pass_program, "highPassThreshold");

	gl.useProgram(state.bloom_high_pass_program);
	gl.uniform1f(state.bloom_high_pass_program_u_highPassThreshold, 0.1);

	state.bloom_blur_program = gl.createProgram(); gl.attachShader(state.bloom_blur_program, state.fullscreen_vert_shader); gl.attachShader(state.bloom_blur_program, state.bloom_blur_shader); gl.linkProgram(state.bloom_blur_program);
	state.bloom_blur_program_a_aPosition = gl.getAttribLocation(state.bloom_blur_program, "aPosition");
	state.bloom_blur_program_u_tex = gl.getUniformLocation(state.bloom_blur_program, "tex");
	state.bloom_blur_program_u_width = gl.getUniformLocation(state.bloom_blur_program, "width");
	state.bloom_blur_program_u_height = gl.getUniformLocation(state.bloom_blur_program, "height");
	state.bloom_blur_program_u_direction = gl.getUniformLocation(state.bloom_blur_program, "direction");

	state.bloom_combine_program = gl.createProgram(); gl.attachShader(state.bloom_combine_program, state.fullscreen_vert_shader); gl.attachShader(state.bloom_combine_program, state.bloom_combine_shader); gl.linkProgram(state.bloom_combine_program);
	state.bloom_combine_program_a_aPosition = gl.getAttribLocation(state.bloom_combine_program, "aPosition");
	state.bloom_combine_program_u_pyr_0 = gl.getUniformLocation(state.bloom_combine_program, "pyr_0");
	state.bloom_combine_program_u_pyr_1 = gl.getUniformLocation(state.bloom_combine_program, "pyr_1");
	state.bloom_combine_program_u_pyr_2 = gl.getUniformLocation(state.bloom_combine_program, "pyr_2");
	state.bloom_combine_program_u_pyr_3 = gl.getUniformLocation(state.bloom_combine_program, "pyr_3");
	state.bloom_combine_program_u_pyr_4 = gl.getUniformLocation(state.bloom_combine_program, "pyr_4");
	state.bloom_combine_program_u_bloomStrength = gl.getUniformLocation(state.bloom_combine_program, "bloomStrength");

	state.palette_program = gl.createProgram(); gl.attachShader(state.palette_program, state.fullscreen_vert_shader); gl.attachShader(state.palette_program, state.palette_shader); gl.linkProgram(state.palette_program);
	state.palette_program_a_aPosition = gl.getAttribLocation(state.palette_program, "aPosition");
	state.palette_program_u_tex = gl.getUniformLocation(state.palette_program, "tex");
	state.palette_program_u_bloomTex = gl.getUniformLocation(state.palette_program, "bloomTex");
	state.palette_program_u_time = gl.getUniformLocation(state.palette_program, "time");
	state.palette_program_u_paletteTex = gl.getUniformLocation(state.palette_program, "paletteTex");

	state.rain_geometry = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, state.rain_geometry);
	gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);

	state.fullscreen_geometry = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry);
	gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([-4, -4, 4, -4, 0, 4]), gl.STATIC_DRAW);

	textures.rain_compute_doublebuffer_1 = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.rain_compute_doublebuffer_1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 80, 0, gl.RGBA, extendedContext.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	state.rain_compute_doublebuffer_1_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.rain_compute_doublebuffer_1_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.rain_compute_doublebuffer_1, 0);

	textures.rain_compute_doublebuffer_2 = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.rain_compute_doublebuffer_2);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 80, 0, gl.RGBA, extendedContext.HALF_FLOAT_OES, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	state.rain_compute_doublebuffer_2_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.rain_compute_doublebuffer_2_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.rain_compute_doublebuffer_2, 0);

	textures.rain_output = gl.createTexture();
	textureSizes.rain_output = {scale: 1};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.rain_output);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.rain_output_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.rain_output_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.rain_output, 0);

	const bloomSize = 0.4;

	textures.bloom_high_pass_pyr_0 = gl.createTexture();
	textureSizes.bloom_high_pass_pyr_0 = {scale: bloomSize / (2 ** 0)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_high_pass_pyr_0_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_0_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_high_pass_pyr_0, 0);

	textures.bloom_high_pass_pyr_1 = gl.createTexture();
	textureSizes.bloom_high_pass_pyr_1 = {scale: bloomSize / (2 ** 1)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_high_pass_pyr_1_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_1_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_high_pass_pyr_1, 0);

	textures.bloom_high_pass_pyr_2 = gl.createTexture();
	textureSizes.bloom_high_pass_pyr_2 = {scale: bloomSize / (2 ** 2)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_2);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_high_pass_pyr_2_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_2_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_high_pass_pyr_2, 0);

	textures.bloom_high_pass_pyr_3 = gl.createTexture();
	textureSizes.bloom_high_pass_pyr_3 = {scale: bloomSize / (2 ** 3)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_3);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_high_pass_pyr_3_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_3_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_high_pass_pyr_3, 0);

	textures.bloom_high_pass_pyr_4 = gl.createTexture();
	textureSizes.bloom_high_pass_pyr_4 = {scale: bloomSize / (2 ** 4)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_4);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_high_pass_pyr_4_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_4_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_high_pass_pyr_4, 0);

	textures.bloom_h_blur_pyr_0 = gl.createTexture();
	textureSizes.bloom_h_blur_pyr_0 = {scale: bloomSize / (2 ** 0)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_h_blur_pyr_0_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_0_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_h_blur_pyr_0, 0);

	textures.bloom_h_blur_pyr_1 = gl.createTexture();
	textureSizes.bloom_h_blur_pyr_1 = {scale: bloomSize / (2 ** 1)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_h_blur_pyr_1_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_1_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_h_blur_pyr_1, 0);

	textures.bloom_h_blur_pyr_2 = gl.createTexture();
	textureSizes.bloom_h_blur_pyr_2 = {scale: bloomSize / (2 ** 2)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_2);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_h_blur_pyr_2_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_2_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_h_blur_pyr_2, 0);

	textures.bloom_h_blur_pyr_3 = gl.createTexture();
	textureSizes.bloom_h_blur_pyr_3 = {scale: bloomSize / (2 ** 3)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_3);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_h_blur_pyr_3_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_3_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_h_blur_pyr_3, 0);

	textures.bloom_h_blur_pyr_4 = gl.createTexture();
	textureSizes.bloom_h_blur_pyr_4 = {scale: bloomSize / (2 ** 4)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_4);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_h_blur_pyr_4_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_4_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_h_blur_pyr_4, 0);

	textures.bloom_v_blur_pyr_0 = gl.createTexture();
	textureSizes.bloom_v_blur_pyr_0 = {scale: bloomSize / (2 ** 0)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_v_blur_pyr_0_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_0_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_v_blur_pyr_0, 0);

	textures.bloom_v_blur_pyr_1 = gl.createTexture();
	textureSizes.bloom_v_blur_pyr_1 = {scale: bloomSize / (2 ** 1)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_v_blur_pyr_1_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_1_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_v_blur_pyr_1, 0);

	textures.bloom_v_blur_pyr_2 = gl.createTexture();
	textureSizes.bloom_v_blur_pyr_2 = {scale: bloomSize / (2 ** 2)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_2);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_v_blur_pyr_2_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_2_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_v_blur_pyr_2, 0);

	textures.bloom_v_blur_pyr_3 = gl.createTexture();
	textureSizes.bloom_v_blur_pyr_3 = {scale: bloomSize / (2 ** 3)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_3);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_v_blur_pyr_3_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_3_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_v_blur_pyr_3, 0);

	textures.bloom_v_blur_pyr_4 = gl.createTexture();
	textureSizes.bloom_v_blur_pyr_4 = {scale: bloomSize / (2 ** 4)};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_4);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_v_blur_pyr_4_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_4_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_v_blur_pyr_4, 0);

	textures.bloom_output = gl.createTexture();
	textureSizes.bloom_output = {scale: 1};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.bloom_output);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.bloom_output_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_output_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.bloom_output, 0);

	textures.palette_output = gl.createTexture();
	textureSizes.palette_output = {scale: 1};
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.palette_output);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	state.palette_output_framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.palette_output_framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures.palette_output, 0);

	textures.palette = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.palette);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 16, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, Uint8ClampedArray.from(palette));
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	textures.msdf = gl.createTexture();
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, textures.msdf);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, msdfImage);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
};

const resize = (gl, width, height) => {

	textureSizes.fullscreen.width = width;
	textureSizes.fullscreen.height = height;

	for (var name in textures) {
		const size = textureSizes[name];
		if (size == null) {
			continue;
		}
		size.width = Math.floor(width * size.scale);
		size.height = Math.floor(height * size.scale);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures[name]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	}
};

const draw = (gl, tick, time) => {

	const flip = tick % 2 == 0;
	const doubleBufferFrontFBO = flip ? state.rain_compute_doublebuffer_2_framebuffer : state.rain_compute_doublebuffer_1_framebuffer;
	const doubleBufferFrontTex = flip ? textures.rain_compute_doublebuffer_2 : textures.rain_compute_doublebuffer_1;
	const doubleBufferBackTex = flip ? textures.rain_compute_doublebuffer_1 : textures.rain_compute_doublebuffer_2;
	let size;

	gl.enableVertexAttribArray(0);
	gl.disable(gl.DEPTH_TEST);
	gl.blendFuncSeparate(1, 1, 1, 1);
	gl.clearColor(0, 0, 0, 1);

	// rain compute
	gl.bindFramebuffer(gl.FRAMEBUFFER, doubleBufferFrontFBO);
	gl.viewport(0, 0, 80, 80);
	gl.useProgram(state.rain_compute_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.rain_compute_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, doubleBufferBackTex); gl.uniform1i(state.rain_compute_program_u_previousComputeState, 0);
	gl.uniform1f(state.rain_compute_program_u_time, time);
	gl.uniform1f(state.rain_compute_program_u_tick, tick);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// rain
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.rain_output_framebuffer);
	size = textureSizes.rain_output; gl.viewport(0, 0, size.width, size.height);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	gl.useProgram(state.rain_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.rain_geometry); gl.vertexAttribPointer(state.rain_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);

	size = textureSizes.fullscreen;
	const aspectRatio = size.width / size.height;
	const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];

	gl.uniform2f(state.rain_program_u_screenSize, screenSize[0], screenSize[1]);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, doubleBufferFrontTex); gl.uniform1i(state.rain_program_u_computeState, 0);
	gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures.msdf); gl.uniform1i(state.rain_program_u_glyphMSDF, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.disable(gl.BLEND);

	// high pass pyramid
	gl.useProgram(state.bloom_high_pass_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.bloom_high_pass_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_0_framebuffer);
	size = textureSizes.bloom_high_pass_pyr_0; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.rain_output); gl.uniform1i(state.bloom_high_pass_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_1_framebuffer);
	size = textureSizes.bloom_high_pass_pyr_1; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_0); gl.uniform1i(state.bloom_high_pass_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_2_framebuffer);
	size = textureSizes.bloom_high_pass_pyr_2; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_1); gl.uniform1i(state.bloom_high_pass_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_3_framebuffer);
	size = textureSizes.bloom_high_pass_pyr_3; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_2); gl.uniform1i(state.bloom_high_pass_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_high_pass_pyr_4_framebuffer);
	size = textureSizes.bloom_high_pass_pyr_4; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_3); gl.uniform1i(state.bloom_high_pass_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// blur pyramids
	gl.useProgram(state.bloom_blur_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.bloom_blur_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_0_framebuffer);
	size = textureSizes.bloom_h_blur_pyr_0; gl.viewport(0, 0, size.width, size.height);
	gl.uniform1f(state.bloom_blur_program_u_width, size.width); gl.uniform1f(state.bloom_blur_program_u_height, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_0); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 1, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_0_framebuffer);
	size = textureSizes.bloom_v_blur_pyr_0; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_0); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 0, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_1_framebuffer);
	size = textureSizes.bloom_h_blur_pyr_1; gl.viewport(0, 0, size.width, size.height);
	gl.uniform1f(state.bloom_blur_program_u_width, size.width); gl.uniform1f(state.bloom_blur_program_u_height, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_1); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 1, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_1_framebuffer);
	size = textureSizes.bloom_v_blur_pyr_1; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_1); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 0, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_2_framebuffer);
	size = textureSizes.bloom_h_blur_pyr_2; gl.viewport(0, 0, size.width, size.height);
	gl.uniform1f(state.bloom_blur_program_u_width, size.width); gl.uniform1f(state.bloom_blur_program_u_height, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_2); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 1, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_2_framebuffer);
	size = textureSizes.bloom_v_blur_pyr_2; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_2); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 0, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_3_framebuffer);
	size = textureSizes.bloom_h_blur_pyr_3; gl.viewport(0, 0, size.width, size.height);
	gl.uniform1f(state.bloom_blur_program_u_width, size.width); gl.uniform1f(state.bloom_blur_program_u_height, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_3); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 1, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_3_framebuffer);
	size = textureSizes.bloom_v_blur_pyr_3; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_3); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 0, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_h_blur_pyr_4_framebuffer);
	size = textureSizes.bloom_h_blur_pyr_4; gl.viewport(0, 0, size.width, size.height);
	gl.uniform1f(state.bloom_blur_program_u_width, size.width); gl.uniform1f(state.bloom_blur_program_u_height, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_high_pass_pyr_4); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 1, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_v_blur_pyr_4_framebuffer);
	size = textureSizes.bloom_v_blur_pyr_4; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_h_blur_pyr_4); gl.uniform1i(state.bloom_blur_program_u_tex, 0);
	gl.uniform2f(state.bloom_blur_program_u_direction, 0, 1);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// bloom combine
	gl.useProgram(state.bloom_combine_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.bloom_combine_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.bloom_output_framebuffer);
	size = textureSizes.bloom_output; gl.viewport(0, 0, size.width, size.height);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_0); gl.uniform1i(state.bloom_combine_program_u_pyr_0, 0);
	gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_1); gl.uniform1i(state.bloom_combine_program_u_pyr_1, 1);
	gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_2); gl.uniform1i(state.bloom_combine_program_u_pyr_2, 2);
	gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_3); gl.uniform1i(state.bloom_combine_program_u_pyr_3, 3);
	gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_v_blur_pyr_4); gl.uniform1i(state.bloom_combine_program_u_pyr_4, 4);
	gl.uniform1f(state.bloom_combine_program_u_bloomStrength, 0.7);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// palette
	gl.bindFramebuffer(gl.FRAMEBUFFER, state.palette_output_framebuffer);
	size = textureSizes.palette_output; gl.viewport(0, 0, size.width, size.height);
	gl.useProgram(state.palette_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.palette_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.rain_output); gl.uniform1i(state.palette_program_u_tex, 0);
	gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, textures.bloom_output); gl.uniform1i(state.palette_program_u_bloomTex, 1);
	gl.uniform1f(state.palette_program_u_time, 0);
	gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textures.palette); gl.uniform1i(state.palette_program_u_paletteTex, 2);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// upscale
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	size = textureSizes.fullscreen; gl.viewport(0, 0, size.width, size.height);
	gl.useProgram(state.fullscreen_program);
	gl.bindBuffer(gl.ARRAY_BUFFER, state.fullscreen_geometry); gl.vertexAttribPointer(state.fullscreen_program_a_aPosition, 2, gl.FLOAT, false, 0, 0);
	gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textures.palette_output); gl.uniform1i(state.fullscreen_program_u_tex, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

};

export {
	init, load, resize, draw
};
