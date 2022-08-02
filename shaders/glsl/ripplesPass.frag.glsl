precision mediump float;
varying vec2 vUV;
uniform float aspectRatio;
uniform float time;
uniform vec3 clicks[5];

uniform sampler2D tex;
uniform sampler2D bloomTex;

void main() {

	float total = 0.0;
	for (int i = 0; i < 5; i++) {
		vec3 click = clicks[i];
		float distanceToClick = length((click.xy - vUV) * vec2(aspectRatio, 1.0));
		float elapsedTime = clamp(time - click.z, -100.0, 100.0);
		float t = distanceToClick - elapsedTime * 0.5;
		total += sin(t * 40.0) / t;
	}
	total *= 0.2;

	vec2 uv = vUV + total * 0.001;
	gl_FragColor = vec4(mix(vec3(0.0), vec3(0.3, 1.0, 0.2), texture2D(tex, uv).r + texture2D(bloomTex, uv).r * 0.5), 1.0);
	// gl_FragColor = vec4(uv, 0.5, 1.0);
}
