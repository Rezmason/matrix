/* shaders/glsl/fullscreen.vert.glsl */
precision mediump float;

attribute vec2 aPosition;   // will come from JS buffer
varying   vec2 vUV;

void main () {
  vUV = aPosition * 0.5 + 0.5;        // (‑1…1) → (0…1)
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
