precision mediump float;
#define PI 3.14159265359

uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D stripes;
uniform float ditherMagnitude;
uniform float time;
uniform vec3 backgroundColor;
varying vec2 vUV;

highp float rand( const in vec2 uv, const in float t ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c + t);
}

void main() {
	vec3 color = texture2D(stripes, vUV).rgb;
	float brightness = min(1., texture2D(tex, vUV).r * 2.) + texture2D(bloomTex, vUV).r;
	float at = brightness - rand( gl_FragCoord.xy, time ) * ditherMagnitude;
	gl_FragColor = vec4(color * at + backgroundColor, 1.0);
}
