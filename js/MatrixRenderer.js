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
  brightnessThreshold,
  showComputationTexture,
  raindropLength,
  cycleStyle
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
    uniform float time;
    uniform float deltaTime;
    uniform float animationSpeed;
    uniform float fallSpeed;
    uniform float cycleSpeed;
    uniform float brightnessChangeBias;
    uniform float glyphSequenceLength;
    uniform float numFontColumns;
    uniform float raindropLength;

    highp float rand( const in vec2 uv ) {
      const highp float a = 12.9898, b = 78.233, c = 43758.5453;
      highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
      return fract(sin(sn) * c);
    }

    highp float blast( const in float x, const in float power ) {
      return pow(pow(pow(x, power), power), power);
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

      #ifdef hasSun
        newBrightness = pow(fract(newBrightness * 0.5), 3.0) * uv.y * 2.0;
      #endif

      #ifdef hasThunder
        vec2 distVec = (gl_FragCoord.xy / resolution.xy - vec2(0.5, 1.0)) * vec2(1.0, 2.0);
        float thunder = (blast(sin(SQRT_5 * simTime * 2.0), 10.0) + blast(sin(SQRT_2 * simTime * 2.0), 10.0));
        thunder *= 30.0 * (1.0 - 1.0 * length(distVec));

        newBrightness *= max(0.0, thunder) * 1.0 + 0.7;

        if (newBrightness > brightness) {
          brightness = newBrightness;
        } else {
          brightness = mix(brightness, newBrightness, brightnessChangeBias * 0.1);
        }
      #else
        brightness = mix(brightness, newBrightness, brightnessChangeBias);
      #endif

      float glyphCycleSpeed = 0.0;
      #ifdef cycleFasterWhenDimmed
        if (brightness > 0.0) glyphCycleSpeed = pow(1.0 - brightness, 4.0);
      #endif
      #ifdef cycleRandomly
        glyphCycleSpeed = fract((glyphTime + 0.7 * sin(SQRT_2 * glyphTime) + 1.1 * sin(SQRT_5 * glyphTime))) * 0.75;
      #endif
      glyphCycle = fract(glyphCycle + deltaTime * cycleSpeed * 0.2 * glyphCycleSpeed);
      float symbol = floor(glyphSequenceLength * glyphCycle);
      float symbolX = mod(symbol, numFontColumns);
      float symbolY = ((numFontColumns - 1.0) - (symbol - symbolX) / numFontColumns);

      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor.r = brightness;
      gl_FragColor.g = glyphCycle;

      #ifdef showComputationTexture
        // Better use of the blue channel, for show and tell
        gl_FragColor.b = min(1.0, glyphCycleSpeed);
        gl_FragColor.a = 1.0;
      #else
        gl_FragColor.b = symbolX / numFontColumns;
        gl_FragColor.a = symbolY / numFontColumns;
      #endif
    }
    `
    ,
    glyphValue
    );
  gpuCompute.setVariableDependencies( glyphVariable, [ glyphVariable ] );

  const brightnessChangeBias = (brightnessThreshold <= 0) ? (animationSpeed * fallSpeed) == 0 ? 1 : Math.min(1, Math.abs(animationSpeed * fallSpeed)) : 1;
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
  });
  if (hasThunder) {
    glyphVariable.material.defines.hasThunder = 1.0;
  }
  if (hasSun) {
    glyphVariable.material.defines.hasSun = 1.0;
  }
  if (showComputationTexture) {
    glyphVariable.material.defines.showComputationTexture = 1.0;
  }

  switch (cycleStyle) {
    case "cycleFasterWhenDimmed":
      glyphVariable.material.defines.cycleFasterWhenDimmed = 1.0;
      break;
    case "cycleRandomly":
    default:
      glyphVariable.material.defines.cycleRandomly = 1.0;
      break;
  }


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
      varying vec2 vUV;

      float median(float r, float g, float b) {
        return max(min(r, g), min(max(r, g), b));
      }

      void main() {

        vec2 uv = vUV;

        uv = vec2(
           (uv.x - 0.5) * slant.x + (uv.y - 0.5) * slant.y,
           (uv.y - 0.5) * slant.x - (uv.x - 0.5) * slant.y
        ) * 0.75 + 0.5;

        #ifdef isPolar
          vec2 diff = uv - vec2(0.5, 1.25);
          float radius = length(diff);
          float angle = atan(diff.y, diff.x) + PI;
          uv = vec2(angle / PI, 1.0 - pow(radius * 0.75, 0.6));
        #endif

        uv.y /= glyphHeightToWidth;

        vec4 glyph = texture2D(glyphs, uv);

        #ifdef showComputationTexture
          gl_FragColor = glyph;
          return;
        #endif

        // Unpack the values from the font texture
        float brightness = glyph.r;
        #ifdef brightnessThreshold
          if (brightness < -1.0) { discard; return; }
          if (brightness > brightnessThreshold) {
            brightness *= 2.0;
          } else {
            brightness = 0.25;
          }
        #endif
        vec2 symbolUV = glyph.ba;
        vec2 glyphUV = fract(uv * numColumns);
        glyphUV -= 0.5;
        glyphUV *= clamp(1.0 - glyphEdgeCrop, 0.0, 1.0);
        glyphUV += 0.5;
        vec4 sample = texture2D(msdf, glyphUV / numFontColumns + symbolUV);

        // The rest is straight up MSDF
        float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
        float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);

        gl_FragColor = vec4(vec3(brightness * alpha), 1.0);
      }
      `
    })
  );
  mesh.frustumCulled = false;

  if (isPolar) {
    mesh.material.defines.isPolar = 1.0;
  }

  if (brightnessThreshold > 0) {
    mesh.material.defines.brightnessThreshold = brightnessThreshold;
  }

  if (showComputationTexture) {
    mesh.material.defines.showComputationTexture = 1.0;
  }

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
