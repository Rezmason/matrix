precision mediump float;
varying vec2 vUV;
uniform float aspectRatio, cameraAspectRatio;
uniform float time;
uniform vec3 clicks[5];

uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D cameraTex;

void main() {

	float intensity = 0.0;
	for (int i = 0; i < 5; i++) {
		vec3 click = clicks[i];
		float distanceToClick = length((click.xy - vUV) * vec2(aspectRatio, 1.0));
		float elapsedTime = clamp(time - click.z, -100.0, 100.0);
		float t = distanceToClick - elapsedTime * 0.5;
		intensity += sin(t * 40.0) / t;
	}
	intensity *= 0.2;

	vec2 uv = vUV + intensity * 0.001;

	float webcamAspectAdjust = cameraAspectRatio / aspectRatio;
	vec2 webcamTransform = vec2(1.0, webcamAspectAdjust);
	if (webcamAspectAdjust > 1.0) {
		webcamTransform = vec2(1.0 / webcamAspectAdjust, 1.0);
	}
	vec2 webcamUV = ((uv - 0.5) * webcamTransform) + 0.5;

	vec3 webcam = texture2D(cameraTex, 1.0 - webcamUV).rgb;
	webcam *= mix(vec3(0.1, 0.3, 0.0), vec3(0.9, 1.0, 0.7), 1.0 - length(vUV - 0.5) * 1.5);

	vec3 code = mix(webcam, vec3(0.7, 1.0, 0.4), texture2D(tex, uv).r * (1.0 + intensity * 0.3) + texture2D(bloomTex, uv).r * 0.5);

	gl_FragColor = vec4(code, 0.0);
}
