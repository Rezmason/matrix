import { makePassFBO } from "./utils.js";

export default (regl, config) => {
  // These two framebuffers are used to compute the raining code.
  // they take turns being the source and destination of the "compute" shader.
  // The half float data type is crucial! It lets us store almost any real number,
  // whereas the default type limits us to integers between 0 and 255.

  // These FBOs are smaller than the screen, because their pixels correspond
  // with glyphs in the final image, and the glyphs are much larger than a pixel.
  const state = Array(2)
    .fill()
    .map(() =>
      regl.framebuffer({
        color: regl.texture({
          radius: config.numColumns,
          wrapT: "clamp",
          type: "half float"
        }),
        depthStencil: false
      })
    );

  const fbo = makePassFBO(regl);

  const update = regl({
    frag: `
      precision highp float;

      #define PI 3.14159265359
      #define SQRT_2 1.4142135623730951
      #define SQRT_5 2.23606797749979

      uniform float numColumns;
      uniform sampler2D lastState;

      uniform bool hasSun;
      uniform bool hasThunder;
      uniform bool showComputationTexture;

      uniform float brightnessChangeBias;
      uniform float brightnessMultiplier;
      uniform float brightnessOffset;
      uniform float cursorEffectThreshold;

      uniform float time;
      uniform float animationSpeed;
      uniform float cycleSpeed;
      uniform float fallSpeed;
      uniform float raindropLength;

      uniform float glyphHeightToWidth;
      uniform float glyphSequenceLength;
      uniform float numFontColumns;
      uniform int cycleStyle;

      uniform float rippleScale;
      uniform float rippleSpeed;
      uniform float rippleThickness;
      uniform int rippleType;

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

      highp float blast( const in float x, const in float power ) {
        return pow(pow(pow(x, power), power), power);
      }

      float ripple(vec2 uv, float simTime) {
        if (rippleType == -1) {
          return 0.;
        }

        float rippleTime = (simTime * 0.5 + 0.2 * sin(simTime)) * rippleSpeed + 1.;

        vec2 offset = rand2(vec2(floor(rippleTime), 0.)) - 0.5;
        vec2 ripplePos = uv + offset;
        float rippleDistance;
        if (rippleType == 0) {
          rippleDistance = max2(abs(ripplePos) * vec2(1.0, glyphHeightToWidth));
        } else if (rippleType == 1) {
          rippleDistance = length(ripplePos);
        }

        float rippleValue = fract(rippleTime) * rippleScale - rippleDistance;

        if (rippleValue > 0. && rippleValue < rippleThickness) {
          return 0.75;
        } else {
          return 0.;
        }
      }

      void main()  {

        vec2 uv = gl_FragCoord.xy / numColumns;

        float columnTimeOffset = rand(vec2(gl_FragCoord.x, 0.0));
        float columnSpeedOffset = rand(vec2(gl_FragCoord.x + 0.1, 0.0));

        vec4 data = texture2D( lastState, uv );

        bool isInitializing = length(data) == 0.;

        if (isInitializing) {
          data = vec4(
            rand(uv),
            showComputationTexture ? 0.5 : rand(uv),
            0.,
            0.
          );
        }

        float brightness = data.r;
        float glyphCycle = data.g;

        float simTime = time * animationSpeed;
        float columnTime = (columnTimeOffset * 1000.0 + simTime * 0.5 * fallSpeed) * (0.5 + columnSpeedOffset * 0.5) + (sin(simTime * fallSpeed * columnSpeedOffset) * 0.2);
        float glyphTime = (gl_FragCoord.y * 0.01 + columnTime) / raindropLength;

        float value = 1.0 - fract((glyphTime + 0.3 * sin(SQRT_2 * glyphTime) + 0.2 * sin(SQRT_5 * glyphTime)));

        float newBrightness = 3.0 * log(value * 1.25);

        if (hasSun) {
          newBrightness = pow(fract(newBrightness * 0.5), 3.0) * uv.y * 2.0;
        }

        if (hasThunder) {
          vec2 distVec = (gl_FragCoord.xy / numColumns - vec2(0.5, 1.0)) * vec2(1.0, 2.0);
          float thunder = (blast(sin(SQRT_5 * simTime), 10.0) + blast(sin(SQRT_2 * simTime), 10.0));
          thunder *= 30.0 * (1.0 - 1.0 * length(distVec));

          newBrightness *= max(0.0, thunder) * 1.0 + 0.7;

          if (newBrightness > brightness) {
            brightness = newBrightness;
          } else {
            brightness = mix(brightness, newBrightness, brightnessChangeBias * 0.1);
          }
        } else if (isInitializing) {
          brightness = newBrightness;
        } else {
          brightness = mix(brightness, newBrightness, brightnessChangeBias);
        }

        float glyphCycleSpeed = 0.0;
        if (cycleStyle == 1) {
          glyphCycleSpeed = fract((glyphTime + 0.7 * sin(SQRT_2 * glyphTime) + 1.1 * sin(SQRT_5 * glyphTime))) * 0.75;
        } else if (cycleStyle == 0) {
          if (brightness > 0.0) glyphCycleSpeed = pow(1.0 - brightness, 4.0);
        }

        glyphCycle = fract(glyphCycle + 0.005 * animationSpeed * cycleSpeed * glyphCycleSpeed);
        float symbol = floor(glyphSequenceLength * glyphCycle);
        float symbolX = mod(symbol, numFontColumns);
        float symbolY = ((numFontColumns - 1.0) - (symbol - symbolX) / numFontColumns);

        float effect = 0.;

        effect += ripple(gl_FragCoord.xy / numColumns * 2.0 - 1.0, simTime);

        if (brightness >= cursorEffectThreshold) {
          effect = 1.0;
        }

        if (brightness > -1.) {
          brightness = brightness * brightnessMultiplier + brightnessOffset;
        }

        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        gl_FragColor.r = brightness;
        gl_FragColor.g = glyphCycle;

        if (showComputationTexture) {
          // Better use of the blue channel, for show and tell
          gl_FragColor.b = min(1.0, glyphCycleSpeed);
          gl_FragColor.a = 1.0;
        } else {
          gl_FragColor.b = symbolY * numFontColumns + symbolX;
          gl_FragColor.a = effect;
        }
      }
    `,

    uniforms: {
      lastState: ({ tick }) => state[tick % 2]
    },

    framebuffer: ({ tick }) => state[(tick + 1) % 2] // The crucial state FBO alternator
  });

  // We render the code into an FBO using MSDFs: https://github.com/Chlumsky/msdfgen
  const render = regl({
    vert: `
      attribute vec2 aPosition;
      uniform float width;
      uniform float height;
      varying vec2 vUV;
      void main() {
        vUV = aPosition / 2.0 + 0.5;
        vec2 size = width > height ? vec2(width / height, 1.) : vec2(1., height / width);
        gl_Position = vec4( size * aPosition, 0.0, 1.0 );
      }
    `,

    frag: `
      #define PI 3.14159265359
      #ifdef GL_OES_standard_derivatives
      #extension GL_OES_standard_derivatives: enable
      #endif
      precision lowp float;

      uniform sampler2D msdfTex;
      uniform sampler2D lastState;
      uniform float numColumns;
      uniform float numFontColumns;
      uniform vec2 slantVec;
      uniform float slantScale;
      uniform float glyphHeightToWidth;
      uniform float glyphEdgeCrop;

      uniform bool isPolar;
      uniform bool showComputationTexture;

      varying vec2 vUV;

      float median3(vec3 i) {
        return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
      }

      void main() {

        vec2 uv = vUV;

        if (isPolar) {
          uv -= 0.5;
          uv *= 0.5;
          uv.y -= 0.5;
          float radius = length(uv);
          float angle = atan(uv.y, uv.x) / (2. * PI) + 0.5;
          uv = vec2(angle * 4. - 0.5, 1.25 - radius * 1.5);
        } else {
          uv = vec2(
          (uv.x - 0.5) * slantVec.x + (uv.y - 0.5) * slantVec.y,
          (uv.y - 0.5) * slantVec.x - (uv.x - 0.5) * slantVec.y
          ) * slantScale + 0.5;
        }

        uv.y /= glyphHeightToWidth;

        vec4 glyph = texture2D(lastState, uv);

        if (showComputationTexture) {
          gl_FragColor = glyph;
          return;
        }

        // Unpack the values from the font texture
        float brightness = glyph.r;

        float effect = glyph.a;
        brightness = max(effect, brightness);

        float symbolIndex = glyph.b;
        vec2 symbolUV = vec2(mod(symbolIndex, numFontColumns), floor(symbolIndex / numFontColumns));
        vec2 glyphUV = fract(uv * numColumns);
        glyphUV -= 0.5;
        glyphUV *= clamp(1.0 - glyphEdgeCrop, 0.0, 1.0);
        glyphUV += 0.5;
        vec3 dist = texture2D(msdfTex, (glyphUV + symbolUV) / numFontColumns).rgb;

        // The rest is straight up MSDF
        float sigDist = median3(dist) - 0.5;
        float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);

        gl_FragColor = vec4(vec3(brightness * alpha), 1.0);
      }
    `,

    uniforms: {
      msdfTex: regl.prop("msdfTex"),
      height: regl.context("viewportWidth"),
      width: regl.context("viewportHeight"),
      lastState: ({ tick }) => state[tick % 2]
    },

    framebuffer: fbo
  });

  return {
    resize: fbo.resize,
    fbo,
    update,
    render
  };
};
