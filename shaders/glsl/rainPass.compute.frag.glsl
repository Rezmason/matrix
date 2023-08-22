precision highp float;

#define PI 3.14159265359
#define SQRT_2 1.4142135623730951
#define SQRT_5 2.23606797749979

uniform sampler2D previousComputeState;

uniform float numColumns, numRows;
uniform float time, tick, cycleFrameSkip;
uniform float animationSpeed, fallSpeed, cycleSpeed;
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
	float cycleSpeed = animationSpeed * cycleSpeed;
	float age = previousAge;
	float symbol = previousSymbol;
	if (mod(tick, cycleFrameSkip) == 0.) {
		age += cycleSpeed * cycleFrameSkip;
		if (age >= 1.) {
			symbol = floor(glyphSequenceLength * randomFloat(screenPos + simTime));
			age = fract(age);
		}
	}

	return vec2(symbol, age);
}

void main()	{
	float simTime = time * animationSpeed;
	vec2 glyphPos = gl_FragCoord.xy;
	vec2 screenPos = glyphPos / vec2(numColumns, numRows);

	vec2 raindrop = computeRaindrop(simTime, glyphPos);

	bool isFirstFrame = tick <= 1.;
	vec4 previous = texture2D( previousComputeState, screenPos );
	vec4 previousSymbol = vec4(previous.ba, 0.0, 0.0);
	vec2 symbol = computeSymbol(simTime, isFirstFrame, glyphPos, screenPos, previousSymbol);
	gl_FragColor = vec4(raindrop, symbol);
}
