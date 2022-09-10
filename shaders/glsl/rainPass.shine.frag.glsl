precision highp float;

// This shader is the star of the show.
// It writes falling rain to four channels of a data texture:
// 		R: brightness
// 		G: unused
// 		B: whether the cell is a "cursor"
// 		A: some other effect, such as a ripple

// Listen.
// I understand if this shader looks confusing. Please don't be discouraged!
// It's just a handful of sine and fract functions. Try commenting parts out to learn
// how the different steps combine to produce the result. And feel free to reach out. -RM

#define PI 3.14159265359
#define SQRT_2 1.4142135623730951
#define SQRT_5 2.23606797749979

uniform sampler2D previousShineState;
uniform float numColumns, numRows;
uniform float time, tick;
uniform float animationSpeed, fallSpeed;

uniform bool hasSun, hasThunder, loops;
uniform float brightnessDecay;
uniform float baseContrast, baseBrightness;
uniform float raindropLength, glyphHeightToWidth;
uniform int rippleType;
uniform float rippleScale, rippleSpeed, rippleThickness;

// Helper functions for generating randomness, borrowed from elsewhere

highp float randomFloat( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

vec2 randomVec2( const in vec2 uv ) {
	return fract(vec2(sin(uv.x * 591.32 + uv.y * 154.077), cos(uv.x * 391.32 + uv.y * 49.077)));
}

float wobble(float x) {
	return x + 0.3 * sin(SQRT_2 * x) + 0.2 * sin(SQRT_5 * x);
}

// Core functions

// Rain time is the shader's key underlying concept.
// It's why glyphs that share a column are lit simultaneously, and are brighter toward the bottom.
float getRainTime(float simTime, vec2 glyphPos) {
	float columnTimeOffset = randomFloat(vec2(glyphPos.x, 0.)) * 1000.;
	float columnSpeedOffset = randomFloat(vec2(glyphPos.x + 0.1, 0.)) * 0.5 + 0.5;
	if (loops) {
		columnSpeedOffset = 0.5;
	}
	float columnTime = columnTimeOffset + simTime * fallSpeed * columnSpeedOffset;
	float rainTime = (glyphPos.y * 0.01 + columnTime) / raindropLength;
	if (!loops) {
		rainTime = wobble(rainTime);
	}
	return rainTime;
}

float getBrightness(float rainTime) {
	return (1. - fract(rainTime)) * baseContrast + baseBrightness;
}

// Additional effects

float applySunShowerBrightness(float brightness, vec2 screenPos) {
	if (brightness >= -4.) {
		brightness = pow(fract(brightness * 0.5), 3.) * screenPos.y * 1.5;
	}
	return brightness;
}

float applyThunderBrightness(float brightness, float simTime, vec2 screenPos) {
	simTime *= 0.5;
	float thunder = 1. - fract(wobble(simTime));
	if (loops) {
		thunder = 1. - fract(simTime + 0.3);
	}

	thunder = log(thunder * 1.5) * 4.;
	thunder = clamp(thunder, 0., 1.);
	thunder = thunder * pow(screenPos.y, 2.) * 3.;
	return brightness + thunder;
}

float applyRippleEffect(float effect, float simTime, vec2 screenPos) {
	if (rippleType == -1) {
		return effect;
	}

	float rippleTime = (simTime * 0.5 + sin(simTime) * 0.2) * rippleSpeed + 1.; // TODO: clarify
	if (loops) {
		rippleTime = (simTime * 0.5) * rippleSpeed + 1.;
	}

	vec2 offset = randomVec2(vec2(floor(rippleTime), 0.)) - 0.5;
	if (loops) {
		offset = vec2(0.);
	}
	vec2 ripplePos = screenPos * 2. - 1. + offset;
	float rippleDistance;
	if (rippleType == 0) {
		vec2 boxDistance = abs(ripplePos) * vec2(1., glyphHeightToWidth);
		rippleDistance = max(boxDistance.x, boxDistance.y);
	} else if (rippleType == 1) {
		rippleDistance = length(ripplePos);
	}

	float rippleValue = fract(rippleTime) * rippleScale - rippleDistance;

	if (rippleValue > 0. && rippleValue < rippleThickness) {
		effect += 0.75;
	}

	return effect;
}

// Main function

vec4 computeResult(float simTime, bool isFirstFrame, vec2 glyphPos, vec2 screenPos, vec4 previous) {

	// Determine the glyph's local time.
	float rainTime = getRainTime(simTime, glyphPos);
	float rainTimeBelow = getRainTime(simTime, glyphPos + vec2(0., -1.));
	float cursor = fract(rainTime) < fract(rainTimeBelow) ? 1.0 : 0.0;

	// Rain time is the backbone of this effect.

	// Determine the glyph's brightness.
	float brightness = getBrightness(rainTime);

	if (hasSun) brightness = applySunShowerBrightness(brightness, screenPos);
	if (hasThunder) brightness = applyThunderBrightness(brightness, simTime, screenPos);

	// Determine the glyph's effect— the amount the glyph lights up for other reasons
	float effect = 0.;
	effect = applyRippleEffect(effect, simTime, screenPos); // Round or square ripples across the grid

	// Blend the glyph's brightness with its previous brightness, so it winks on and off organically
	if (!isFirstFrame) {
		float previousBrightness = previous.r;
		brightness = mix(previousBrightness, brightness, brightnessDecay);
	}

	vec4 result = vec4(brightness, fract(rainTime), cursor, effect);
	return result;
}

void main()	{
	float simTime = time * animationSpeed;
	bool isFirstFrame = tick <= 1.;
	vec2 glyphPos = gl_FragCoord.xy;
	vec2 screenPos = glyphPos / vec2(numColumns, numRows);
	vec4 previous = texture2D( previousShineState, screenPos );
	gl_FragColor = computeResult(simTime, isFirstFrame, glyphPos, screenPos, previous);
}
