precision mediump float;
uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D backgroundTex;
uniform float bloomStrength;
varying vec2 vUV;

vec4 getBrightness(vec2 uv) {
	vec4 primary = texture2D(tex, uv);
	vec4 bloom = texture2D(bloomTex, uv) * bloomStrength;
	return min((primary + bloom) * (2.0 - bloomStrength), 1.0);
}

void main() {
	vec3 bgColor = texture2D(backgroundTex, vUV).rgb;

	// Combine the texture and bloom, then blow it out to reveal more of the image
	vec4 brightness = getBrightness(vUV);
	
	gl_FragColor = vec4(bgColor * (brightness.r + brightness.g * 2.0), 1.0);
}
