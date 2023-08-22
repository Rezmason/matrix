#define PI 3.14159265359
precision lowp float;
attribute vec2 aPosition, aCorner;
uniform float glyphVerticalSpacing;
uniform vec2 screenSize;
uniform float time, animationSpeed;
varying vec2 vUV;

void main() {
	vUV = aPosition + aCorner;
	vec2 position = (aPosition * vec2(1., glyphVerticalSpacing) + aCorner);
	vec4 pos = vec4((position - 0.5) * 2.0, 0.0, 1.0);
	pos.xy *= screenSize;
	gl_Position = pos;
}
