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
		total += (1.0 - distanceToClick)
		* sin(distanceToClick * 50.0 - time * 12.0)
		* pow(1.0 - min(1.0, (time - click.z) / 3.0), 2.0);
	}
	total *= 0.2;

	vec2 uv = vUV + total * 0.03;
	gl_FragColor = vec4(mix(vec3(0.0), vec3(0.3, 1.0, 0.2), texture2D(tex, uv).r + texture2D(bloomTex, uv).r * 0.5), 1.0);
	// gl_FragColor = vec4(uv, 0.5, 1.0);
}
