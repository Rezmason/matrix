precision mediump float;

uniform float width, height;
uniform sampler2D tex;
uniform vec2 direction;

varying vec2 vUV;

void main() {
	vec2 size = width > height ? vec2(width / height, 1.) : vec2(1., height / width);
	gl_FragColor =
		texture2D(tex, vUV) * 0.442 +
		(
			texture2D(tex, vUV + direction / max(width, height) * size) +
			texture2D(tex, vUV - direction / max(width, height) * size)
		) * 0.279;
}
