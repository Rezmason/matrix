#define PI 3.14159265359
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives: enable
#endif
precision lowp float;

uniform sampler2D lastState;
uniform float numColumns, numRows;
uniform sampler2D glyphTex;
uniform float glyphHeightToWidth, glyphSequenceLength, glyphTextureColumns, glyphEdgeCrop;
uniform vec2 slantVec;
uniform float slantScale;
uniform bool isPolar;
uniform bool showComputationTexture;
uniform bool volumetric;

varying vec2 vUV;
varying vec3 vChannel;
varying vec4 vGlyph;

float median3(vec3 i) {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

float getSymbolIndex(float glyphCycle) {
	float symbol = floor(glyphSequenceLength * glyphCycle);
	float symbolX = mod(symbol, glyphTextureColumns);
	float symbolY = ((glyphTextureColumns - 1.0) - (symbol - symbolX) / glyphTextureColumns);
	return symbolY * glyphTextureColumns + symbolX;
}

void main() {

	vec2 uv = vUV;

	if (!volumetric) {
		if (isPolar) {
			// Curves the UV space to make letters appear to radiate from up above
			uv -= 0.5;
			uv *= 0.5;
			uv.y -= 0.5;
			float radius = length(uv);
			float angle = atan(uv.y, uv.x) / (2. * PI) + 0.5;
			uv = vec2(angle * 4. - 0.5, 1.5 - pow(radius, 0.5) * 1.5);
		} else {
			// Applies the slant, scaling the UV space
			// to guarantee the viewport is still covered
			uv = vec2(
			(uv.x - 0.5) * slantVec.x + (uv.y - 0.5) * slantVec.y,
			(uv.y - 0.5) * slantVec.x - (uv.x - 0.5) * slantVec.y
			) * slantScale + 0.5;
		}
		uv.y /= glyphHeightToWidth;
	}

	vec4 glyph = volumetric ? vGlyph : texture2D(lastState, uv);

	if (showComputationTexture) {
		gl_FragColor = glyph;
		return;
	}

	// Unpack the values from the font texture
	float brightness = glyph.r;
	float symbolIndex = getSymbolIndex(glyph.g);
	float quadDepth = glyph.b;
	float effect = glyph.a;

	brightness = max(effect, brightness);
	if (volumetric) {
		brightness = min(1.0, brightness * quadDepth * 1.25);
	}

	// resolve UV to MSDF texture coord
	vec2 symbolUV = vec2(mod(symbolIndex, glyphTextureColumns), floor(symbolIndex / glyphTextureColumns));
	vec2 glyphUV = fract(uv * vec2(numColumns, numRows));
	glyphUV -= 0.5;
	glyphUV *= clamp(1.0 - glyphEdgeCrop, 0.0, 1.0);
	glyphUV += 0.5;
	vec2 msdfUV = (glyphUV + symbolUV) / glyphTextureColumns;

	// MSDF
	vec3 dist = texture2D(glyphTex, msdfUV).rgb;
	float sigDist = median3(dist) - 0.5;
	float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);

	gl_FragColor = vec4(vChannel * brightness * alpha, 1.0);
}
