precision highp float;

// This shader is the star of the show.
// In normal operation, each pixel represents a glyph's:
//   R: brightness
//   G: progress through the glyph sequence
//   B: current glyph index
//   A: additional brightness, for effects

#define PI 3.14159265359
#define RADS_TO_HZ 0.15915494309
#define SQRT_2 1.4142135623730951
#define SQRT_5 2.23606797749979

uniform float time;
uniform float numColumns, numRows;
uniform sampler2D lastState;
uniform bool hasSun;
uniform bool hasThunder;
uniform bool showComputationTexture;
uniform float brightnessMinimum, brightnessMultiplier, brightnessOffset, brightnessMix;
uniform float animationSpeed, fallSpeed, cycleSpeed;
uniform float raindropLength;
uniform float glyphHeightToWidth;
uniform int cycleStyle;
uniform float rippleScale, rippleSpeed, rippleThickness;
uniform int rippleType;
uniform float cursorEffectThreshold;

float max2(vec2 v) {
  return max(v.x, v.y);
}

highp float rand( const in vec2 uv ) {
  const highp float a = 12.9898, b = 78.233, c = 43758.5453;
  highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
  return fract(sin(sn) * c);
}

vec2 rand2(vec2 p) {
  return fract(vec2(sin(p.x * 591.32 + p.y * 154.077), cos(p.x * 391.32 + p.y * 49.077)));
}

float getRainTime(float simTime, vec2 glyphPos) {
  float columnTimeOffset = rand(vec2(glyphPos.x, 0.0));
  float columnSpeedOffset = rand(vec2(glyphPos.x + 0.1, 0.0));
  // columnSpeedOffset = 0.0; // loop
  float columnTime = (columnTimeOffset * 1000.0 + simTime * 0.5 * fallSpeed) * (0.5 + columnSpeedOffset * 0.5) + (sin(RADS_TO_HZ * simTime * fallSpeed * columnSpeedOffset) * 0.2);
  return (glyphPos.y * 0.01 + columnTime) / raindropLength;
}

float getRainBrightness(float rainTime) {
  float value = 1.0 - fract((rainTime + 0.3 * sin(RADS_TO_HZ * SQRT_2 * rainTime) + 0.2 * sin(RADS_TO_HZ * SQRT_5 * rainTime)));
  // value = 1.0 - fract(rainTime); // loop
  return log(value * 1.25) * 3.0;
}

float getGlyphCycleSpeed(float rainTime, float brightness) {
  float glyphCycleSpeed = 0.0;
  if (cycleStyle == 0 && brightness > 0.0) {
    glyphCycleSpeed = pow(1.0 - brightness, 4.0);
  } else if (cycleStyle == 1) {
    glyphCycleSpeed = fract((rainTime + 0.7 * sin(RADS_TO_HZ * SQRT_2 * rainTime) + 1.1 * sin(RADS_TO_HZ * SQRT_5 * rainTime))) * 0.75;
    // glyphCycleSpeed = fract(rainTime) * 0.75; // loop
  }
  return glyphCycleSpeed;
}

float applySunShower(float rainBrightness, vec2 screenPos) {
  if (rainBrightness < -4.) {
    return rainBrightness;
  }
  float value = pow(fract(rainBrightness * 0.5), 3.0) * screenPos.y * 1.5;
  return value;
}

float applyThunder(float rainBrightness, float simTime, vec2 screenPos) {
  simTime *= 0.5;
  float thunder = 1.0 - fract((simTime + 0.3 * sin(RADS_TO_HZ * SQRT_2 * simTime) + 0.2 * sin(RADS_TO_HZ * SQRT_5 * simTime)));
  // thunder = 1.0 - fract(simTime + 0.3); // loop
  thunder = log(thunder * 1.5) * 4.0;
  thunder = clamp(thunder, 0., 1.);
  thunder = thunder * pow(screenPos.y, 2.) * 3.;
  return rainBrightness + thunder;
}

float applyRippleEffect(float effect, float simTime, vec2 screenPos) {
  if (rippleType == -1) {
    return effect;
  }

  float rippleTime = (simTime * 0.5 + 0.2 * sin(RADS_TO_HZ * simTime)) * rippleSpeed + 1.;
  // rippleTime = (simTime * 0.5) * rippleSpeed + 1.; // loop

  vec2 offset = rand2(vec2(floor(rippleTime), 0.)) - 0.5;
  // offset = vec2(0.); // loop
  vec2 ripplePos = screenPos * 2.0 - 1.0 + offset;
  float rippleDistance;
  if (rippleType == 0) {
    rippleDistance = max2(abs(ripplePos) * vec2(1.0, glyphHeightToWidth));
  } else if (rippleType == 1) {
    rippleDistance = length(ripplePos);
  }

  float rippleValue = fract(rippleTime) * rippleScale - rippleDistance;

  if (rippleValue > 0. && rippleValue < rippleThickness) {
    return effect + 0.75;
  } else {
    return effect;
  }
}

float applyCursorEffect(float effect, float brightness) {
  if (brightness >= cursorEffectThreshold) {
    effect = 1.0;
  }
  return effect;
}

void main()  {

  vec2 glyphPos = gl_FragCoord.xy;
  vec2 screenPos = glyphPos / vec2(numColumns, numRows);
  float simTime = time * animationSpeed;

  // Read the current values of the glyph
  vec4 data = texture2D( lastState, screenPos );
  bool isInitializing = length(data) == 0.;
  float oldRainBrightness = data.r;
  float oldGlyphCycle = data.g;
  if (isInitializing) {
    oldGlyphCycle = showComputationTexture ? 0.5 : rand(screenPos);
  }

  if (oldRainBrightness <= 0.0) {
    // oldGlyphCycle = showComputationTexture ? 0.5 : rand(screenPos); // loop
  }

  float rainTime = getRainTime(simTime, glyphPos);
  float rainBrightness = getRainBrightness(rainTime);

  if (hasSun) rainBrightness = applySunShower(rainBrightness, screenPos);
  if (hasThunder) rainBrightness = applyThunder(rainBrightness, simTime, screenPos);

  float glyphCycleSpeed = getGlyphCycleSpeed(rainTime, rainBrightness);
  float glyphCycle = fract(oldGlyphCycle + 0.005 * animationSpeed * cycleSpeed * glyphCycleSpeed);

  float effect = 0.;
  effect = applyRippleEffect(effect, simTime, screenPos);
  effect = applyCursorEffect(effect, rainBrightness);

  float glyphDepth = rand(vec2(glyphPos.x, 0.0));

  if (rainBrightness > brightnessMinimum) {
    rainBrightness = rainBrightness * brightnessMultiplier + brightnessOffset;
  }

  if (!isInitializing) {
    rainBrightness = mix(oldRainBrightness, rainBrightness, brightnessMix);
  }

  if (showComputationTexture) {
    gl_FragColor = vec4(
      rainBrightness,
      glyphCycle,
      min(1.0, glyphCycleSpeed), // Better use of the blue channel, for show and tell
      1.0
    );
  } else {
    gl_FragColor = vec4(
      rainBrightness,
      glyphCycle,
      glyphDepth,
      effect
    );
  }
}
