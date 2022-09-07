precision highp float;

// This shader is the star of the show. For each glyph, it determines its:
// 		R: brightness
// 		G: progress through the glyph sequence
// 		B: unused!
// 		A: additional brightness for effects

// Listen.
// I understand if this shader looks confusing. Please don't be discouraged!
// It's just a handful of sine and fract functions. Try commenting parts out to learn
// how the different steps combine to produce the result. And feel free to reach out. -RM

#define PI 3.14159265359
#define SQRT_2 1.4142135623730951
#define SQRT_5 2.23606797749979

uniform sampler2D previousState;
uniform float numColumns, numRows;
uniform float time, tick, cycleFrameSkip;
uniform float animationSpeed, fallSpeed, cycleSpeed;

uniform bool hasSun, hasThunder, loops;
uniform bool showComputationTexture;
uniform float brightnessOverride, brightnessThreshold, brightnessDecay;
uniform float baseContrast, baseBrightness;
uniform float raindropLength, glyphHeightToWidth, glyphSequenceLength;
uniform int cycleStyle, rippleType;
uniform float rippleScale, rippleSpeed, rippleThickness;
uniform float cursorEffectThreshold;

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
	return (glyphPos.y * 0.01 + columnTime) / raindropLength;
}

float getBrightness(float rainTime) {
	float value = 1. - fract(wobble(rainTime));
	if (loops) {
		value = 1. - fract(rainTime);
	}
	return value * baseContrast + baseBrightness;
}

float getCycleSpeed(float rainTime, float brightness) {
	float localCycleSpeed = 0.;
	if (cycleStyle == 0 && brightness > 0.) {
		localCycleSpeed = pow(1. - brightness, 4.);
	} else if (cycleStyle == 1) {
		localCycleSpeed = fract(rainTime);
	}
	return animationSpeed * cycleSpeed * localCycleSpeed;
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

float applyCursorEffect(float effect, float brightness) {
	if (brightness >= cursorEffectThreshold) {
		effect = 1.;
	}
	return effect;
}

// Main function

vec4 computeResult(bool isFirstFrame, vec4 previousResult, vec2 glyphPos, vec2 screenPos) {

	// Determine the glyph's local time.
	float simTime = time * animationSpeed;
	float rainTime = getRainTime(simTime, glyphPos);

	// Rain time is the backbone of this effect.

	// Determine the glyph's brightness.
	float previousBrightness = previousResult.r;
	float brightness = getBrightness(rainTime);
	if (hasSun) {
		brightness = applySunShowerBrightness(brightness, screenPos);
	}
	if (hasThunder) {
		brightness = applyThunderBrightness(brightness, simTime, screenPos);
	}

	// Determine the glyph's cycle— the percent this glyph has progressed through the glyph sequence
	float previousCycle = previousResult.g;
	bool resetGlyph = isFirstFrame;
	if (loops) {
		resetGlyph = resetGlyph || previousBrightness <= 0.;
	}
	if (resetGlyph) {
		previousCycle = showComputationTexture ? 0. : randomFloat(screenPos);
	}
	float localCycleSpeed = getCycleSpeed(rainTime, brightness);
	float cycle = previousCycle;
	if (mod(tick, cycleFrameSkip) == 0.) {
		cycle = fract(previousCycle + 0.005 * localCycleSpeed * cycleFrameSkip);
	}

	// Determine the glyph's effect— the amount the glyph lights up for other reasons
	float effect = 0.;
	effect = applyRippleEffect(effect, simTime, screenPos); // Round or square ripples across the grid
	effect = applyCursorEffect(effect, brightness); // The bright glyphs at the "bottom" of raindrops

	// Modes that don't fade glyphs set their actual brightness here
	if (brightnessOverride > 0. && brightness > brightnessThreshold) {
		brightness = brightnessOverride;
	}

	// Blend the glyph's brightness with its previous brightness, so it winks on and off organically
	if (!isFirstFrame) {
		brightness = mix(previousBrightness, brightness, brightnessDecay);
	}

	vec4 result = vec4(brightness, cycle, 0.0, effect);

	// Better use of the alpha channel, for demonstrating how the glyph cycle works
	if (showComputationTexture) {
		result.a = min(1., localCycleSpeed);
	}

	return result;
}

void main()	{
	bool isFirstFrame = tick <= 1.;
	vec2 glyphPos = gl_FragCoord.xy;
	vec2 screenPos = glyphPos / vec2(numColumns, numRows);
	vec4 previousResult = texture2D( previousState, screenPos );
	gl_FragColor = computeResult(isFirstFrame, previousResult, glyphPos, screenPos);
}
