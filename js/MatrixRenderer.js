const makeMatrixRenderer = (renderer, texture, {
  sharpness,
  numColumns,
  animationSpeed, fallSpeed, cycleSpeed,
  glyphSequenceLength,
  numGlyphColumns,
  hasThunder,
  hasSun,
  isPolar,
  isSlanted
}) => {
  const matrixRenderer = {};
  const camera = new THREE.OrthographicCamera( -0.5, 0.5, 0.5, -0.5, 0.0001, 10000 );
  const scene = new THREE.Scene();
  const gpuCompute = new GPUComputationRenderer( numColumns, numColumns, renderer );
  const glyphValue = gpuCompute.createTexture();
  const pixels = glyphValue.image.data;
  for (let i = 0; i < numColumns * numColumns; i++) {
    pixels[i * 4 + 0] = 0;
    pixels[i * 4 + 1] = Math.random();
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
    uniform float now;
    uniform float delta;
    uniform float animationSpeed;
    uniform float fallSpeed;
    uniform float cycleSpeed;
    uniform float brightnessChangeBias;
    uniform float glyphSequenceLength;
    uniform float numGlyphColumns;

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
      float cycle = data.g;

      float simTime = now * 0.0005 * animationSpeed;
      float columnTime = (columnTimeOffset * 1000.0 + simTime * fallSpeed) * (0.5 + columnSpeedOffset * 0.5) + (sin(simTime * fallSpeed * 2.0 * columnSpeedOffset) * 0.2);
      float glyphTime = gl_FragCoord.y * 0.01 + columnTime;

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


      float glyphCycleSpeed = delta * cycleSpeed * 0.2 * pow(1.0 - brightness, 4.0);
      cycle = fract(cycle + glyphCycleSpeed);
      float symbol = floor(glyphSequenceLength * cycle);
      float symbolX = mod(symbol, numGlyphColumns);
      float symbolY = ((numGlyphColumns - 1.0) - (symbol - symbolX) / numGlyphColumns);

      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor.r = brightness;
      gl_FragColor.g = cycle;
      gl_FragColor.b = symbolX / numGlyphColumns;
      gl_FragColor.a = symbolY / numGlyphColumns;
    }
    `
    ,
    glyphValue
    );
  gpuCompute.setVariableDependencies( glyphVariable, [ glyphVariable ] );

  const brightnessChangeBias = (animationSpeed * fallSpeed) == 0 ? 1 : Math.min(1, Math.abs(animationSpeed * fallSpeed));
  Object.assign(glyphVariable.material.uniforms, {
    now: { type: "f", value: 0 },
    delta: { type: "f", value: 0.01 },
    animationSpeed: { type: "f", value: animationSpeed },
    fallSpeed: { type: "f", value: fallSpeed },
    cycleSpeed: {type: "f", value: cycleSpeed },
    glyphSequenceLength: { type: "f", value: glyphSequenceLength },
    numGlyphColumns: {type: "f", value: numGlyphColumns },
    brightnessChangeBias: { type: "f", value: brightnessChangeBias },
  });
  if (hasThunder) {
    glyphVariable.material.defines.hasThunder = 1.0;
  }
  if (hasSun) {
    glyphVariable.material.defines.hasSun = 1.0;
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
        msdf: { type: "t", value: texture },
        numColumns: {type: "f", value: numColumns},
        sharpness: { type: "f", value: sharpness },
        numGlyphColumns: {type: "f", value: numGlyphColumns},
        resolution: {type: "v2", value: new THREE.Vector2() },
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
      #define BIG_ENOUGH 0.001
      #define MODIFIED_ALPHATEST (0.02 * isBigEnough / BIG_ENOUGH)
      uniform float sharpness;
      uniform sampler2D msdf;
      uniform sampler2D glyphs;
      uniform float numColumns;
      uniform float numGlyphColumns;
      varying vec2 vUV;

      float median(float r, float g, float b) {
        return max(min(r, g), min(max(r, g), b));
      }

      void main() {

        vec2 uv = vUV;
        #ifdef isPolar
          vec2 diff = vUV - vec2(0.5, 1.25);
          float radius = length(diff);
          float angle = atan(diff.y, diff.x) + PI;
          uv = vec2(angle / PI, 1.0 - pow(radius * 0.75, 0.6));
        #endif
        #ifdef isSlanted
          float angle = PI * 0.125;
          vec2 rotation = vec2(cos(angle), sin(angle));
          uv = vec2(
             (vUV.x - 0.5) * rotation.x + (vUV.y - 0.5) * rotation.y,
             (vUV.y - 0.5) * rotation.x - (vUV.x - 0.5) * rotation.y) * 0.75 + 0.5;
        #endif

        // Unpack the values from the glyph texture
        vec4 glyph = texture2D(glyphs, uv);
        float brightness = glyph.r;
        vec2 symbolUV = glyph.ba;
        vec4 sample = texture2D(msdf, fract(uv * numColumns) / numGlyphColumns + symbolUV);

        // The rest is straight up MSDF
        float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
        float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);
        float dscale = 0.353505 / sharpness;
        vec2 duv = dscale * (dFdx(uv) + dFdy(uv));
        float isBigEnough = max(abs(duv.x), abs(duv.y));
        if (isBigEnough > BIG_ENOUGH) {
          float ratio = BIG_ENOUGH / isBigEnough;
          alpha = ratio * alpha + (1.0 - ratio) * (sigDist + 0.5);
        }
        if (isBigEnough <= BIG_ENOUGH && alpha < 0.5) { discard; return; }
        if (alpha < 0.5 * MODIFIED_ALPHATEST) { discard; return; }

        gl_FragColor = vec4(vec3(brightness * alpha), 1.0);

        // gl_FragColor = vec4(glyph.r, glyph.b, glyph.a, 1.0);
      }
      `
    })
  );
  mesh.frustumCulled = false;

  if (isPolar) {
    mesh.material.defines.isPolar = 1.0;
  }

  if (isSlanted) {
    mesh.material.defines.isSlanted = 1.0;
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

    const delta = ((now - last > 1000) ? 0 : now - last) / 1000 * animationSpeed;
    last = now;

    glyphVariable.material.uniforms.now.value = now;
    glyphVariable.material.uniforms.delta.value = delta;

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
