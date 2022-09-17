#define PI 3.14159265359
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives: enable
#endif
precision lowp float;

uniform sampler2D raindropState, symbolState, effectState;
uniform float numColumns, numRows;
uniform sampler2D glyphTex, glintTex;
uniform float glyphHeightToWidth, glyphSequenceLength, glyphEdgeCrop;
uniform float baseContrast, baseBrightness;
uniform float brightnessOverride, brightnessThreshold;
uniform vec2 glyphTextureGridSize;
uniform vec2 slantVec;
uniform float slantScale;
uniform bool isPolar;
uniform bool showDebugView;
uniform bool volumetric;
uniform bool isolateCursor, isolateGlint;

varying vec2 vUV;
varying vec4 vRaindrop, vSymbol, vEffect;
varying float vDepth;

float median3(vec3 i) {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

float modI(float a, float b) {
	float m = a - floor((a + 0.5) / b) * b;
	return floor(m + 0.5);
}

vec2 getUV(vec2 uv) {

	if (volumetric) {
		return uv;
	}

	if (isPolar) {
		// Curved space that makes letters appear to radiate from up above
		uv -= 0.5;
		uv *= 0.5;
		uv.y -= 0.5;
		float radius = length(uv);
		float angle = atan(uv.y, uv.x) / (2. * PI) + 0.5;
		uv = vec2(fract(angle * 4. - 0.5), 1.5 * (1. - sqrt(radius)));
	} else {
		// Applies the slant and scales space so the viewport is fully covered
		uv = vec2(
			(uv.x - 0.5) * slantVec.x + (uv.y - 0.5) * slantVec.y,
			(uv.y - 0.5) * slantVec.x - (uv.x - 0.5) * slantVec.y
		) * slantScale + 0.5;
	}

	uv.y /= glyphHeightToWidth;

	return uv;
}

vec2 getBrightness(float brightness, float cursor, float multipliedEffects, float addedEffects) {
	if (!isolateCursor) {
		cursor = 0.;
	}
	brightness = (1. - brightness) * baseContrast + baseBrightness;

	// Modes that don't fade glyphs set their actual brightness here
	if (brightnessOverride > 0. && brightness > brightnessThreshold && cursor == 0.) {
		brightness = brightnessOverride;
	}

	brightness *= multipliedEffects;
	brightness += addedEffects;

	// In volumetric mode, distant glyphs are dimmer
	if (volumetric && !showDebugView) {
		brightness = brightness * min(1., vDepth);
	}

	return vec2(brightness * (1. - cursor), brightness * cursor);
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
		vec3 dist = texture2D(glyphTex, uv).rgb;
		float sigDist = median3(dist) - 0.5;
		symbol.r = clamp(sigDist / fwidth(sigDist) + 0.5, 0., 1.);
	}

	if (isolateGlint) {
		vec3 dist = texture2D(glintTex, uv).rgb;
		float sigDist = median3(dist) - 0.5;
		symbol.g = clamp(sigDist / fwidth(sigDist) + 0.5, 0., 1.);
	}

	return symbol;
}

void main() {

	vec2 uv = getUV(vUV);

	// Unpack the values from the data textures
	vec4 raindropData = volumetric ? vRaindrop : texture2D(raindropState, uv);
	vec4   symbolData = volumetric ?   vSymbol : texture2D(  symbolState, uv);
	vec4   effectData = volumetric ?   vEffect : texture2D(  effectState, uv);

	vec2 brightness = getBrightness(raindropData.r, raindropData.g, effectData.r, effectData.g);
	vec2 symbol = getSymbol(uv, symbolData.r);

	if (showDebugView) {
		gl_FragColor = vec4(
			vec3(
				raindropData.g,
				vec2(
					1. - (raindropData.r * 3.),
					1. - (raindropData.r * 8.)
				) * (1. - raindropData.g)
			) * symbol.r,
			1.
		);
	} else {
		gl_FragColor = vec4(brightness * symbol.r, brightness.r * symbol.g, 0.);
	}
}
