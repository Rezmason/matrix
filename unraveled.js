const extendedContext = {};
const programs = {};
const textures = {};
const dynamicSizes = { fullscreen: {scale: 1}};
const framebuffers = {};
const geometry = {};
const attributes = {};
const uniforms = {};

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
	uniform vec2 size;
	varying vec2 vUV;

	void main() {
		vUV = aPosition;
		vec2 proportion = (size.y > size.x ? vec2(size.y / size.x, 1.) : vec2(1., size.x / size.y));
		gl_Position = vec4((aPosition - 0.5) * 2.0 * proportion, 0.0, 1.0);
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

	uniform vec2 size;
	uniform sampler2D tex;
	uniform vec2 direction;

	varying vec2 vUV;

	void main() {
		vec2 proportion = (size.y > size.x ? vec2(size.y / size.x, 1.) : vec2(1., size.x / size.y));
		gl_FragColor =
			texture2D(tex, vUV) * 0.442 +
			(
				texture2D(tex, vUV + direction / max(size.y, size.x) * proportion) +
				texture2D(tex, vUV - direction / max(size.y, size.x) * proportion)
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

	const buildShader = (source, isFragment) => {
		const shader = gl.createShader(isFragment ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return shader;
	};

	const buildProgram = (vertexShader, fragmentShader) => {
		const program = gl.createProgram();
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);
		return program;
	};

	const fullscreen_frag_shader = buildShader(fullscreen_frag_shader_source, true);
	const fullscreen_vert_shader = buildShader(fullscreen_vert_shader_source, false);
	const rain_compute_shader = buildShader(rain_compute_shader_source, true);
	const rain_frag_shader = buildShader(rain_frag_shader_source, true);
	const rain_vert_shader = buildShader(rain_vert_shader_source, false);
	const bloom_high_pass_shader = buildShader(bloom_high_pass_shader_source, true);
	const bloom_blur_shader = buildShader(bloom_blur_shader_source, true);
	const bloom_combine_shader = buildShader(bloom_combine_shader_source, true);
	const palette_shader = buildShader(palette_shader_source, true);

	programs.fullscreen = buildProgram(fullscreen_vert_shader, fullscreen_frag_shader);
	uniforms.rain_program_tex = gl.getUniformLocation(programs.fullscreen, "tex");
	attributes.fullscreen_program_aPosition = gl.getAttribLocation(programs.fullscreen, "aPosition");

	programs.rain_compute = buildProgram(fullscreen_vert_shader, rain_compute_shader);
	attributes.rain_compute_program_aPosition = gl.getAttribLocation(programs.rain_compute, "aPosition");
	uniforms.rain_compute_program_time = gl.getUniformLocation(programs.rain_compute, "time");
	uniforms.rain_compute_program_previousComputeState = gl.getUniformLocation(programs.rain_compute, "previousComputeState");
	uniforms.rain_compute_program_tick = gl.getUniformLocation(programs.rain_compute, "tick");
	gl.useProgram(programs.rain_compute);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "numColumns"), 80);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "glyphSequenceLength"), 57);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "numRows"), 80);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "fallSpeed"), 0.3);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "raindropLength"), 0.75);
	gl.uniform1f(gl.getUniformLocation(programs.rain_compute, "cycleSpeed"), 0.03);

	programs.rain = buildProgram(rain_vert_shader, rain_frag_shader);
	attributes.rain_program_aPosition = gl.getAttribLocation(programs.rain, "aPosition");
	uniforms.rain_program_size = gl.getUniformLocation(programs.rain, "size");
	uniforms.rain_program_computeState = gl.getUniformLocation(programs.rain, "computeState");
	uniforms.rain_program_glyphMSDF = gl.getUniformLocation(programs.rain, "glyphMSDF");
	gl.useProgram(programs.rain);
	gl.uniform2f(gl.getUniformLocation(programs.rain, "glyphTextureGridSize"), 8, 8);
	gl.uniform1f(gl.getUniformLocation(programs.rain, "numColumns"), 80);
	gl.uniform2f(gl.getUniformLocation(programs.rain, "glyphMSDFSize"), 512, 512);
	gl.uniform1f(gl.getUniformLocation(programs.rain, "numRows"), 80);
	gl.uniform1f(gl.getUniformLocation(programs.rain, "msdfPxRange"), 4);

	programs.bloom_high_pass = buildProgram(fullscreen_vert_shader, bloom_high_pass_shader);
	attributes.bloom_high_pass_program_aPosition = gl.getAttribLocation(programs.bloom_high_pass, "aPosition");
	uniforms.bloom_high_pass_program_tex = gl.getUniformLocation(programs.bloom_high_pass, "tex");
	gl.useProgram(programs.bloom_high_pass);
	gl.uniform1f(gl.getUniformLocation(programs.bloom_high_pass, "highPassThreshold"), 0.1);

	programs.bloom_blur = buildProgram(fullscreen_vert_shader, bloom_blur_shader);
	attributes.bloom_blur_program_aPosition = gl.getAttribLocation(programs.bloom_blur, "aPosition");
	uniforms.bloom_blur_program_tex = gl.getUniformLocation(programs.bloom_blur, "tex");
	uniforms.bloom_blur_program_size = gl.getUniformLocation(programs.bloom_blur, "size");
	uniforms.bloom_blur_program_direction = gl.getUniformLocation(programs.bloom_blur, "direction");

	programs.bloom_combine = buildProgram(fullscreen_vert_shader, bloom_combine_shader);
	attributes.bloom_combine_program_aPosition = gl.getAttribLocation(programs.bloom_combine, "aPosition");
	uniforms.bloom_combine_program_pyr_0 = gl.getUniformLocation(programs.bloom_combine, "pyr_0");
	uniforms.bloom_combine_program_pyr_1 = gl.getUniformLocation(programs.bloom_combine, "pyr_1");
	uniforms.bloom_combine_program_pyr_2 = gl.getUniformLocation(programs.bloom_combine, "pyr_2");
	uniforms.bloom_combine_program_pyr_3 = gl.getUniformLocation(programs.bloom_combine, "pyr_3");
	uniforms.bloom_combine_program_pyr_4 = gl.getUniformLocation(programs.bloom_combine, "pyr_4");
	gl.useProgram(programs.bloom_combine);
	gl.uniform1f(gl.getUniformLocation(programs.bloom_combine, "bloomStrength"), 0.7);

	programs.palette = buildProgram(fullscreen_vert_shader, palette_shader);
	attributes.palette_program_aPosition = gl.getAttribLocation(programs.palette, "aPosition");
	uniforms.palette_program_tex = gl.getUniformLocation(programs.palette, "tex");
	uniforms.palette_program_bloomTex = gl.getUniformLocation(programs.palette, "bloomTex");
	uniforms.palette_program_time = gl.getUniformLocation(programs.palette, "time");
	uniforms.palette_program_paletteTex = gl.getUniformLocation(programs.palette, "paletteTex");

	geometry.rain = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, geometry.rain);
	gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);

	geometry.fullscreen = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, geometry.fullscreen);
	gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([-4, -4, 4, -4, 0, 4]), gl.STATIC_DRAW);

	const setTexParams = (texture, isLinear, data) => {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		const filter = isLinear ? gl.LINEAR : gl.NEAREST;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		if (data != null) {
			if (data instanceof HTMLImageElement) {
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, data.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, Uint8ClampedArray.from(data.flat()));
			}
		}
	}

	for (let i = 0; i < 2; i++) {
		const name = "rain_compute_doublebuffer_" + i;
		const texture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 80, 80, 0, gl.RGBA, extendedContext.HALF_FLOAT_OES, null);
		setTexParams(texture, false);

		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		textures[name] = texture;
		framebuffers[name] = framebuffer;
	}

	const buildAndAddRTT = (name, scale) => {
		const texture = gl.createTexture();
		dynamicSizes[name] = {scale};
		setTexParams(texture, true);
		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		textures[name] = texture;
		framebuffers[name] = framebuffer;
	};

	buildAndAddRTT("rain_output", 1);
	for (let i = 0; i < 5; i++) {
		const scale = 0.4 / (2 ** i);
		buildAndAddRTT("bloom_high_pass_pyr_" + i, scale);
		buildAndAddRTT("bloom_h_blur_pyr_" + i, scale);
		buildAndAddRTT("bloom_v_blur_pyr_" + i, scale);
	}
	buildAndAddRTT("bloom_output", 1);
	buildAndAddRTT("palette_output", 1);

	textures.palette = gl.createTexture();
	setTexParams(textures.palette, true, palette);

	textures.msdf = gl.createTexture();
	setTexParams(textures.msdf, true, msdfImage);

	gl.enableVertexAttribArray(0);
	gl.disable(gl.DEPTH_TEST);
	gl.blendFuncSeparate(1, 1, 1, 1);
	gl.clearColor(0, 0, 0, 1);
};

const resize = (gl, width, height) => {

	dynamicSizes.fullscreen.width = width;
	dynamicSizes.fullscreen.height = height;

	for (var name in textures) {
		const size = dynamicSizes[name];
		if (size == null) {
			continue;
		}
		size.width = Math.floor(width * size.scale);
		size.height = Math.floor(height * size.scale);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures[name]);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size.width, size.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	}

	gl.useProgram(programs.rain);
	gl.uniform2f(uniforms.rain_program_size, width, height);
};

const setViewportSizeTo = (gl, name) => {
	const size = dynamicSizes[name];
	gl.viewport(0, 0, size.width, size.height);
}

const bindTextureTo = (gl, texName, uniformName, index) => {
	gl.activeTexture(gl.TEXTURE0 + index);
	gl.bindTexture(gl.TEXTURE_2D, textures[texName]);
	gl.uniform1i(uniforms[uniformName], index);
};

const bindGeometryTo = (gl, geometryName, attributeName) => {
	gl.bindBuffer(gl.ARRAY_BUFFER, geometry[geometryName]);
	gl.vertexAttribPointer(attributes[attributeName], 2, gl.FLOAT, false, 0, 0);
};

const draw = (gl, tick, time) => {

	const doubleBufferFrontName = "rain_compute_doublebuffer_" + (tick % 2);
	const doubleBufferBackName = "rain_compute_doublebuffer_" + ((tick + 1) % 2);

	// rain compute
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[doubleBufferFrontName]);
	gl.viewport(0, 0, 80, 80);
	gl.useProgram(programs.rain_compute);
	bindGeometryTo(gl, "fullscreen", "rain_compute_program_aPosition");
	bindTextureTo(gl, doubleBufferBackName, "rain_compute_program_previousComputeState", 0);
	gl.uniform1f(uniforms.rain_compute_program_time, time);
	gl.uniform1f(uniforms.rain_compute_program_tick, tick);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// rain
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers.rain_output);
	setViewportSizeTo(gl, "rain_output");
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.enable(gl.BLEND);
	gl.useProgram(programs.rain);
	bindGeometryTo(gl, "rain", "rain_program_aPosition");

	bindTextureTo(gl, doubleBufferFrontName, "rain_program_computeState", 0);
	bindTextureTo(gl, "msdf", "rain_program_glyphMSDF", 1);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	gl.disable(gl.BLEND);

	// high pass pyramid
	gl.useProgram(programs.bloom_high_pass);
	gl.bindBuffer(gl.ARRAY_BUFFER, geometry.fullscreen);
	gl.vertexAttribPointer(attributes.bloom_high_pass_program_aPosition, 2, gl.FLOAT, false, 0, 0);
	for (let i = 0; i < 5; i++) {
		const name = "bloom_high_pass_pyr_" + i;
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[name]);
		const size = dynamicSizes[name];
		gl.viewport(0, 0, size.width, size.height);
		const src = (i === 0 ? textures.rain_output : textures["bloom_high_pass_pyr_" + (i - 1)]);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, src);
		gl.uniform1i(uniforms.bloom_high_pass_program_tex, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	// blur pyramids
	gl.useProgram(programs.bloom_blur);
	gl.bindBuffer(gl.ARRAY_BUFFER, geometry.fullscreen);
	gl.vertexAttribPointer(attributes.bloom_blur_program_aPosition, 2, gl.FLOAT, false, 0, 0);
	for (let i = 0; i < 5; i++) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers["bloom_h_blur_pyr_" + i]);
		const hSize = dynamicSizes["bloom_h_blur_pyr_" + i];
		gl.viewport(0, 0, hSize.width, hSize.height);
		gl.uniform2f(uniforms.bloom_blur_program_size, hSize.width, hSize.height);
		bindTextureTo(gl, "bloom_high_pass_pyr_" + i, "bloom_blur_program_tex", 0);
		gl.uniform2f(uniforms.bloom_blur_program_direction, 1, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers["bloom_v_blur_pyr_" + i]);
		const vSize = dynamicSizes["bloom_v_blur_pyr_" + i];
		gl.viewport(0, 0, vSize.width, vSize.height);
		bindTextureTo(gl, "bloom_h_blur_pyr_" + i, "bloom_blur_program_tex", 0);
		gl.uniform2f(uniforms.bloom_blur_program_direction, 0, 1);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	// bloom combine
	gl.useProgram(programs.bloom_combine);
	bindGeometryTo(gl, "fullscreen", "bloom_combine_program_aPosition");
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers.bloom_output);
	setViewportSizeTo(gl, "bloom_output");
	for (let i = 0; i < 5; i++) {
		gl.activeTexture(gl.TEXTURE0 + i);
		gl.bindTexture(gl.TEXTURE_2D, textures["bloom_v_blur_pyr_" + i]);
		gl.uniform1i(uniforms["bloom_combine_program_pyr_" + i], i);
	}
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// palette
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers.palette_output);
	setViewportSizeTo(gl, "palette_output");
	gl.useProgram(programs.palette);
	bindGeometryTo(gl, "fullscreen", "palette_program_aPosition");
	bindTextureTo(gl, "rain_output", "palette_program_tex", 0);
	bindTextureTo(gl, "bloom_output", "palette_program_bloomTex", 1);
	gl.uniform1f(uniforms.palette_program_time, time);
	bindTextureTo(gl, "palette", "palette_program_paletteTex", 2);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// upscale
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	setViewportSizeTo(gl, "fullscreen");
	gl.useProgram(programs.fullscreen);
	bindGeometryTo(gl, "fullscreen", "fullscreen_program_aPosition");
	bindTextureTo(gl, "palette_output", "fullscreen_program_tex", 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

};

export {
	init, load, resize, draw
};
