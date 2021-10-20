precision mediump float;
uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D backgroundTex;
varying vec2 vUV;

void main() {
  vec3 bgColor = texture2D(backgroundTex, vUV).rgb;
  float brightness = pow(min(1., texture2D(tex, vUV).r * 2.) + texture2D(bloomTex, vUV).r, 1.5);
  gl_FragColor = vec4(bgColor * brightness, 1.0);
}
