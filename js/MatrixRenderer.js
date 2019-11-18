const makeMatrixRenderer = (renderer, {
  fontTexture,
  numColumns,
  animationSpeed, fallSpeed, cycleSpeed,
  glyphSequenceLength,
  numFontColumns,
  hasThunder,
  hasSun,
  isPolar,
  slant,
  glyphHeightToWidth,
  glyphEdgeCrop,
  cursorEffectThreshold,
  showComputationTexture,
  raindropLength,
  cycleStyle,
  rippleType,
  rippleScale,
  rippleSpeed,
  rippleThickness,
  brightnessMultiplier,
  brightnessOffset,
}) => {
  const matrixRenderer = {};
  const camera = new THREE.OrthographicCamera( -0.5, 0.5, 0.5, -0.5, 0.0001, 10000 );
  const scene = new THREE.Scene();
  const gpuCompute = new GPUComputationRenderer( numColumns, numColumns, renderer );
  const glyphValue = gpuCompute.createTexture();
  const pixels = glyphValue.image.data;

  const scramble = i => Math.sin(i) * 0.5 + 0.5;

  for (let i = 0; i < numColumns * numColumns; i++) {
    pixels[i * 4 + 0] = 0;
    pixels[i * 4 + 1] = showComputationTexture ? 0.5 : scramble(i);
    pixels[i * 4 + 2] = 0;
    pixels[i * 4 + 3] = 0;
  }

const glyphVariable = gpuCompute.addVariable(
    "glyph",
    `
    precision highp float;

    #define PI 3.14159265359
    #define SQRT_2 1.4142135623730951
    #define SQRT_5 2.23606797749979

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
    uniform float deltaTime;
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

    highp float rand( const in vec2 uv ) {
      const highp float a = 12.9898, b = 78.233, c = 43758.5453;
      highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
      return fract(sin(sn) * c);
    }

    float max2(vec2 v) {
      return max(v.x, v.y);
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

      float rippleTime = (simTime + 0.2 * sin(simTime * 2.0)) * rippleSpeed + 1.;

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

      vec2 cellSize = 1.0 / resolution.xy;
      vec2 uv = (gl_FragCoord.xy) * cellSize;

      float columnTimeOffset = rand(vec2(gl_FragCoord.x, 0.0));
      float columnSpeedOffset = rand(vec2(gl_FragCoord.x + 0.1, 0.0));

      vec4 data = texture2D( glyph, uv );

      float brightness = data.r;
      float glyphCycle = data.g;

      float simTime = time * 0.0005 * animationSpeed;
      float columnTime = (columnTimeOffset * 1000.0 + simTime * fallSpeed) * (0.5 + columnSpeedOffset * 0.5) + (sin(simTime * fallSpeed * 2.0 * columnSpeedOffset) * 0.2);
      float glyphTime = (gl_FragCoord.y * 0.01 + columnTime) / raindropLength;

      float value = 1.0 - fract((glyphTime + 0.3 * sin(SQRT_2 * glyphTime) + 0.2 * sin(SQRT_5 * glyphTime)));

      float newBrightness = 3.0 * log(value * 1.25);

      if (hasSun) {
        newBrightness = pow(fract(newBrightness * 0.5), 3.0) * uv.y * 2.0;
      }

      if (hasThunder) {
        vec2 distVec = (gl_FragCoord.xy / resolution.xy - vec2(0.5, 1.0)) * vec2(1.0, 2.0);
        float thunder = (blast(sin(SQRT_5 * simTime * 2.0), 10.0) + blast(sin(SQRT_2 * simTime * 2.0), 10.0));
        thunder *= 30.0 * (1.0 - 1.0 * length(distVec));

        newBrightness *= max(0.0, thunder) * 1.0 + 0.7;

        if (newBrightness > brightness) {
          brightness = newBrightness;
        } else {
          brightness = mix(brightness, newBrightness, brightnessChangeBias * 0.1);
        }
      } else {
        brightness = mix(brightness, newBrightness, brightnessChangeBias);
      }

      float glyphCycleSpeed = 0.0;
      if (cycleStyle == 1) {
        glyphCycleSpeed = fract((glyphTime + 0.7 * sin(SQRT_2 * glyphTime) + 1.1 * sin(SQRT_5 * glyphTime))) * 0.75;
      } else if (cycleStyle == 0) {
        if (brightness > 0.0) glyphCycleSpeed = pow(1.0 - brightness, 4.0);
      }

      glyphCycle = fract(glyphCycle + deltaTime * cycleSpeed * 0.2 * glyphCycleSpeed);
      float symbol = floor(glyphSequenceLength * glyphCycle);
      float symbolX = mod(symbol, numFontColumns);
      float symbolY = ((numFontColumns - 1.0) - (symbol - symbolX) / numFontColumns);

      float effect = 0.;

      effect += ripple(gl_FragCoord.xy / resolution.xy * 2.0 - 1.0, simTime);

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
    `
    ,
    glyphValue
    );
  gpuCompute.setVariableDependencies( glyphVariable, [ glyphVariable ] );

  const brightnessChangeBias = (animationSpeed * fallSpeed) == 0 ? 1 : Math.min(1, Math.abs(animationSpeed * fallSpeed));

  let cycleStyleInt;
  switch (cycleStyle) {
    case "cycleFasterWhenDimmed":
      cycleStyleInt = 0;
      break;
    case "cycleRandomly":
    default:
      cycleStyleInt = 1;
      break;
  }

  let rippleTypeInt;
  switch (rippleType) {
    case "box":
      rippleTypeInt = 0;
      break;
    case "circle":
      rippleTypeInt = 1;
      break;
    default:
      rippleTypeInt = -1;
  }

  Object.assign(glyphVariable.material.uniforms, {
    time: { type: "f", value: 0 },
    deltaTime: { type: "f", value: 0.01 },
    animationSpeed: { type: "f", value: animationSpeed },
    fallSpeed: { type: "f", value: fallSpeed },
    cycleSpeed: {type: "f", value: cycleSpeed },
    glyphSequenceLength: { type: "f", value: glyphSequenceLength },
    numFontColumns: {type: "f", value: numFontColumns },
    raindropLength: {type: "f", value: raindropLength },
    brightnessChangeBias: { type: "f", value: brightnessChangeBias },
    rippleThickness: { type: "f", value: rippleThickness},
    rippleScale: { type: "f", value: rippleScale},
    rippleSpeed: { type: "f", value: rippleSpeed},
    cursorEffectThreshold: { type: "f", value: cursorEffectThreshold},
    brightnessMultiplier: { type: "f", value: brightnessMultiplier},
    brightnessOffset: { type: "f", value: brightnessOffset},
    glyphHeightToWidth: {type: "f", value: glyphHeightToWidth},
    hasSun: { type: "b", value: hasSun },
    hasThunder: { type: "b", value: hasThunder },
    rippleType: { type: "i", value: rippleTypeInt },
    showComputationTexture: { type: "b", value: showComputationTexture },
    cycleStyle: { type: "i", value: cycleStyleInt },
  });

  const error = gpuCompute.init();
  if ( error !== null ) {
    console.error( error );
  }

  const glyphRTT = gpuCompute.getCurrentRenderTarget( glyphVariable ).texture;

  const mesh = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(),
    new THREE.RawShaderMaterial({
      uniforms: {
        glyphs: { type: "t", value: glyphRTT },
        msdf: { type: "t", value: fontTexture },
        numColumns: {type: "f", value: numColumns},
        numFontColumns: {type: "f", value: numFontColumns},
        resolution: {type: "v2", value: new THREE.Vector2() },
        slant: {type: "v2", value: new THREE.Vector2(Math.cos(slant), Math.sin(slant)) },
        glyphHeightToWidth: {type: "f", value: glyphHeightToWidth},
        glyphEdgeCrop: {type: "f", value: glyphEdgeCrop},
        isPolar: { type: "b", value: isPolar },
        showComputationTexture: { type: "b", value: showComputationTexture },
      },
      vertexShader: `
      attribute vec2 uv;
      attribute vec3 position;
      uniform vec2 resolution;
      varying vec2 vUV;
      void main() {
        vUV = uv;
        gl_Position = vec4( resolution * position.xy, 0.0, 1.0 );
      }
      `,
      fragmentShader: `
      #define PI 3.14159265359
      #ifdef GL_OES_standard_derivatives
      #extension GL_OES_standard_derivatives: enable
      #endif
      precision lowp float;

      uniform sampler2D msdf;
      uniform sampler2D glyphs;
      uniform float numColumns;
      uniform float numFontColumns;
      uniform vec2 slant;
      uniform float glyphHeightToWidth;
      uniform float glyphEdgeCrop;

      uniform bool isPolar;
      uniform bool showComputationTexture;

      varying vec2 vUV;

      float median(float r, float g, float b) {
        return max(min(r, g), min(max(r, g), b));
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
             (uv.x - 0.5) * slant.x + (uv.y - 0.5) * slant.y,
             (uv.y - 0.5) * slant.x - (uv.x - 0.5) * slant.y
          ) * 0.75 + 0.5;
        }

        uv.y /= glyphHeightToWidth;

        vec4 glyph = texture2D(glyphs, uv);

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
        vec4 sample = texture2D(msdf, (glyphUV + symbolUV) / numFontColumns);

        // The rest is straight up MSDF
        float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
        float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);

        gl_FragColor = vec4(vec3(brightness * alpha), 1.0);
      }
      `
    })
  );
  mesh.frustumCulled = false;

  scene.add( mesh );

  let start = NaN;
  let last = NaN;

  matrixRenderer.pass = new THREE.RenderPass( scene, camera );

  matrixRenderer.render = () => {
    if (isNaN(start)) {
      start = Date.now();
      last = 0;
    }
    const now = Date.now() - start;

    if (now - last > 50) {
      last = now;
      return;
    }

    const deltaTime = ((now - last > 1000) ? 0 : now - last) / 1000 * animationSpeed;
    last = now;

    glyphVariable.material.uniforms.time.value = now;
    glyphVariable.material.uniforms.deltaTime.value = deltaTime;

    gpuCompute.compute();
    renderer.render( scene, camera );
  };

  matrixRenderer.resize = (width, height) => {
    if (width > height) {
      mesh.material.uniforms.resolution.value.set(2, 2 * width / height);
    } else {
      mesh.material.uniforms.resolution.value.set(2 * height / width, 2);
    }
  };

  return matrixRenderer;
};
