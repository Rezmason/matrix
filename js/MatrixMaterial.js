const makeMatrixMaterial = (texture, sharpness) => new THREE.RawShaderMaterial({
  uniforms: {
    map: { "type": "t", value: texture },
    sharpness: { "type": "f", value: sharpness },
  },
  vertexShader:`
    attribute vec2 uv;
    attribute vec3 position;
    attribute float brightness;
    uniform mat4 projectionMatrix;
    uniform mat4 modelViewMatrix;
    varying vec2 vUV;
    varying float vBrightness;
    void main(void) {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vUV = uv;
      vBrightness = brightness;
    }
  `,
  fragmentShader:`
    #ifdef GL_OES_standard_derivatives
    #extension GL_OES_standard_derivatives: enable
    #endif
    precision lowp float;
    #define BIG_ENOUGH 0.001
    #define MODIFIED_ALPHATEST (0.02 * isBigEnough / BIG_ENOUGH)
    uniform sampler2D map;
    uniform float sharpness;
    varying vec2 vUV;
    varying float vBrightness;
    float median(float r, float g, float b) {
      return max(min(r, g), min(max(r, g), b));
    }
    void main() {
      vec3 sample = texture2D(map, vUV).rgb;
      float sigDist = median(sample.r, sample.g, sample.b) - 0.5;
      float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0);
      float dscale = 0.353505 / sharpness;
      vec2 duv = dscale * (dFdx(vUV) + dFdy(vUV));
      float isBigEnough = max(abs(duv.x), abs(duv.y));
      if (isBigEnough > BIG_ENOUGH) {
        float ratio = BIG_ENOUGH / isBigEnough;
        alpha = ratio * alpha + (1.0 - ratio) * (sigDist + 0.5);
      }
      if (isBigEnough <= BIG_ENOUGH && alpha < 0.5) { discard; return; }
      if (alpha < 0.5 * MODIFIED_ALPHATEST) { discard; return; }
      gl_FragColor = vec4(vec3(vBrightness * alpha), 1);
    }
  `,
});
