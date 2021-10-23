#define PI 3.14159265359
precision lowp float;
attribute vec2 aPosition, aCorner;
uniform sampler2D lastState;
uniform float density;
uniform vec2 quadSize;
uniform float glyphHeightToWidth, glyphVerticalSpacing;
uniform mat4 camera, transform;
uniform vec2 screenSize;
uniform float time, animationSpeed, forwardSpeed;
uniform bool volumetric;
uniform bool showComputationTexture;
uniform float resurrectingCodeRatio;
varying vec2 vUV;
varying vec3 vChannel;
varying vec4 vGlyph;

highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

void main() {

	vUV = (aPosition + aCorner) * quadSize;
	vGlyph = texture2D(lastState, aPosition * quadSize);

	// Calculate the world space position
	float quadDepth = 0.0;
	if (volumetric && !showComputationTexture) {
		quadDepth = fract(vGlyph.b + time * animationSpeed * forwardSpeed);
		vGlyph.b = quadDepth;
	}
	vec2 position = (aPosition * vec2(1., glyphVerticalSpacing) + aCorner * vec2(density, 1.)) * quadSize;
	vec4 pos = vec4((position - 0.5) * 2.0, quadDepth, 1.0);

	// "Resurrected" columns are in the green channel, 
	// and are vertically flipped (along with their glyphs)
	vChannel = vec3(1.0, 0.0, 0.0);
	if (volumetric && rand(vec2(aPosition.x, 0)) < resurrectingCodeRatio) {
		pos.y = -pos.y;
		vChannel = vec3(0.0, 1.0, 0.0);
	}

	// Convert the world space position to screen space
	if (volumetric) {
		pos.x /= glyphHeightToWidth;
		pos = camera * transform * pos;
	} else {
		pos.xy *= screenSize;
	}

	gl_Position = pos;
}
