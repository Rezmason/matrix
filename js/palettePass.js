import { make1DTexture, makePassFBO, makePass } from "./utils.js";

export default ({ regl }, inputs) => {
	const output = makePassFBO(regl);
	const render = regl({
		frag: `
			precision mediump float;
			#define PI 3.14159265359

			uniform sampler2D tex, bloomTex, paletteTex;
			uniform float time;
			varying vec2 vUV;

			highp float rand( const in vec2 uv, const in float t ) {
				const highp float a = 12.9898, b = 78.233, c = 43758.5453;
				highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
				return fract(sin(sn) * c + t);
			}

			void main() {
				vec4 primary = texture2D(tex, vUV);
				vec4 bloom = texture2D(bloomTex, vUV);
				vec4 brightness = primary + bloom - rand( gl_FragCoord.xy, time ) * 0.0167;
				gl_FragColor = vec4(
					texture2D( paletteTex, vec2(brightness.r, 0.0)).rgb
						+ min(vec3(0.756, 1.0, 0.46) * brightness.g * 2.0, vec3(1.0)),
					1.0
				);
			}
		`,
		uniforms: {
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			paletteTex: make1DTexture(regl, [
				[0.0, 0.0, 0.0, 1.0],
				[0.03, 0.13, 0.0, 1.0],
				[0.06, 0.25, 0.01, 1.0],
				[0.09, 0.38, 0.02, 1.0],
				[0.15, 0.46, 0.07, 1.0],
				[0.21, 0.54, 0.13, 1.0],
				[0.28, 0.63, 0.19, 1.0],
				[0.34, 0.71, 0.25, 1.0],
				[0.41, 0.8, 0.31, 1.0],
				[0.47, 0.88, 0.37, 1.0],
				[0.53, 0.97, 0.43, 1.0],
				[0.61, 0.97, 0.52, 1.0],
				[0.69, 0.98, 0.62, 1.0],
				[0.69, 0.98, 0.62, 1.0],
				[0.69, 0.98, 0.62, 1.0],
				[0.69, 0.98, 0.62, 1.0],
			]),
		},
		framebuffer: output,
	});

	return makePass(
		{
			primary: output,
		},
		null,
		(w, h) => output.resize(w, h),
		() => render()
	);
};
