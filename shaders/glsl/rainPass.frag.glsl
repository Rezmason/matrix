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
uniform float glyphHeightToWidth, glyphSequenceLength, glyphEdgeCrop;
uniform float baseContrast, baseBrightness, glintContrast, glintBrightness;
uniform float brightnessOverride, brightnessThreshold;
uniform vec2 glyphTextureGridSize;
uniform bool isolateCursor;

varying vec2 vUV;

float median3(vec3 i) {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

float modI(float a, float b) {
	float m = a - floor((a + 0.5) / b) * b;
	return floor(m + 0.5);
}

vec2 getUV(vec2 uv) {
	uv.y /= glyphHeightToWidth;
	return uv;
}

vec3 getBrightness(vec2 raindrop, vec2 uv) {

	float base = raindrop.r;
	bool isCursor = bool(raindrop.g) && isolateCursor;
	float glint = base;

	vec2 textureUV = fract(uv * vec2(numColumns, numRows));
	base = base * baseContrast + baseBrightness;
	glint = glint * glintContrast + glintBrightness;

	// Modes that don't fade glyphs set their actual brightness here
	if (brightnessOverride > 0. && base > brightnessThreshold && !isCursor) {
		base = brightnessOverride;
	}

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
	uv -= 0.5;
	uv *= clamp(1. - glyphEdgeCrop, 0., 1.);
	uv += 0.5;
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

	vec2 uv = getUV(vUV);

	// Unpack the values from the data textures
	vec4 data = texture2D(computeState, uv);

	vec3 brightness = getBrightness(data.rg, uv);
	vec2 symbol = getSymbol(uv, data.b);

	gl_FragColor = vec4(brightness.rg * symbol.r, brightness.b * symbol.g, 0.);
}
