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

	// Combine the texture and bloom
	float brightness = brightnessRGB.r + brightnessRGB.g + brightnessRGB.b;

	// Dither: subtract a random value from the brightness
	brightness = brightness - rand( gl_FragCoord.xy, time ) * ditherMagnitude;

	// Map the brightness to a position in the palette texture
	gl_FragColor = texture2D( palette, vec2(brightness, 0.0)) + vec4(backgroundColor, 0.0);
}
