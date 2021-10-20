precision mediump float;
varying vec2 vUV;
uniform sampler2D tex;
uniform float highPassThreshold;
void main() {
  vec3 lumaColor = texture2D(tex, vUV).rgb;
  if (lumaColor.r < highPassThreshold) lumaColor.r = 0.0;
  if (lumaColor.g < highPassThreshold) lumaColor.g = 0.0;
  if (lumaColor.b < highPassThreshold) lumaColor.b = 0.0;
  gl_FragColor = vec4(lumaColor, 1.0);
}
