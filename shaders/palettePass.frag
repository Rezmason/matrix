precision mediump float;
#define PI 3.14159265359

uniform sampler2D tex;
uniform sampler2D bloomTex;
uniform sampler2D palette;
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
	vec4 brightnessRGB = texture2D( tex, vUV ) + texture2D( bloomTex, vUV );
	float brightness = brightnessRGB.r + brightnessRGB.g + brightnessRGB.b;
	float at = brightness - rand( gl_FragCoord.xy, time ) * ditherMagnitude;
	gl_FragColor = texture2D( palette, vec2(at, 0.0)) + vec4(backgroundColor, 0.0);
}
