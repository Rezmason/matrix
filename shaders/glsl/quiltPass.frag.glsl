precision mediump float;
uniform sampler2D quiltTexture;
uniform float pitch;
uniform float tilt;
uniform float center;
uniform float invView;
uniform float flipImageX;
uniform float flipImageY;
uniform float subp;
uniform float tileX;
uniform float tileY;
uniform vec2 quiltViewPortion;
varying vec2 vUV;

vec2 texArr(vec3 uvz) {
  float z = floor(uvz.z * tileX * tileY);
  float x = (mod(z, tileX) + uvz.x) / tileX;
  float y = (floor(z / tileX) + uvz.y) / tileY;
  return vec2(x, y) * quiltViewPortion;
}

float remap(float value, float from1, float to1, float from2, float to2) {
 return (value - from1) / (to1 - from1) * (to2 - from2) + from2;
}

void main() {
  vec4 rgb[3];
  vec3 nuv = vec3(vUV.xy, 0.0);

  // Flip UVs if necessary
  nuv.x = (1.0 - flipImageX) * nuv.x + flipImageX * (1.0 - nuv.x);
  nuv.y = (1.0 - flipImageY) * nuv.y + flipImageY * (1.0 - nuv.y);

  for (int i = 0; i < 3; i++) {
    nuv.z = (vUV.x + float(i) * subp + vUV.y * tilt) * pitch - center;
    nuv.z = mod(nuv.z + ceil(abs(nuv.z)), 1.0);
    nuv.z = (1.0 - invView) * nuv.z + invView * (1.0 - nuv.z);
    rgb[i] = texture2D(quiltTexture, texArr(vec3(vUV.x, vUV.y, nuv.z)));
  }

  gl_FragColor = vec4(rgb[0].r, rgb[1].g, rgb[2].b, 1);
}
