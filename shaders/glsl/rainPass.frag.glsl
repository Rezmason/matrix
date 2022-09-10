#define PI 3.14159265359
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives: enable
#endif
precision lowp float;

uniform sampler2D shineState, symbolState;
uniform float numColumns, numRows;
uniform sampler2D glyphTex;
uniform float glyphHeightToWidth, glyphSequenceLength, glyphEdgeCrop;
uniform float brightnessOverride, brightnessThreshold, cursorBrightness;
uniform vec2 glyphTextureGridSize;
uniform vec2 slantVec;
uniform float slantScale;
uniform bool isPolar;
uniform bool showDebugView;
uniform bool volumetric;

varying vec2 vUV;
varying vec3 vChannel;
varying vec4 vShine, vSymbol;
varying float vDepth;

float median3(vec3 i) {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

float modI(float a, float b) {
	float m = a - floor((a + 0.5) / b) * b;
	return floor(m + 0.5);
}

vec2 getSymbolUV(float symbol) {
	float symbolX = modI(symbol, glyphTextureGridSize.x);
	float symbolY = (symbol - symbolX) / glyphTextureGridSize.x;
	symbolY = glyphTextureGridSize.y - symbolY - 1.;
	return vec2(symbolX, symbolY);
}

void main() {

	vec2 uv = vUV;

	// In normal mode, derives the current glyph and UV from vUV
	if (!volumetric) {
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
	}

	// Unpack the values from the data textures
	vec4 shine = volumetric ? vShine : texture2D(shineState, uv);
	vec4 symbol = volumetric ? vSymbol : texture2D(symbolState, uv);
	vec2 symbolUV = getSymbolUV(symbol.r);

	float brightness = shine.r;

	// Modes that don't fade glyphs set their actual brightness here
	if (brightnessOverride > 0. && brightness > brightnessThreshold) {
		brightness = brightnessOverride;
	}

	brightness = max(shine.b * cursorBrightness, brightness);
	brightness = max(shine.a, brightness);
	// In volumetric mode, distant glyphs are dimmer
	if (volumetric && !showDebugView) {
		brightness = brightness * min(1., vDepth);
	}

	// resolve UV to cropped position of glyph in MSDF texture
	vec2 glyphUV = fract(uv * vec2(numColumns, numRows));
	glyphUV -= 0.5;
	glyphUV *= clamp(1. - glyphEdgeCrop, 0., 1.);
	glyphUV += 0.5;
	vec2 msdfUV = (glyphUV + symbolUV) / glyphTextureGridSize;

	// MSDF: calculate brightness of fragment based on distance to shape
	vec3 dist = texture2D(glyphTex, msdfUV).rgb;
	float sigDist = median3(dist) - 0.5;
	float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0., 1.);

	if (showDebugView) {
		gl_FragColor = vec4(
			vec3(
				shine.b,
				vec2(
					1.0 - (shine.g * 3.0),
					1.0 - (shine.g * 10.0)
				) * (1.0 - shine.b)
			) * alpha,
			1.
		);
	} else {
		gl_FragColor = vec4(vChannel * brightness * alpha, 1.);
	}

}
