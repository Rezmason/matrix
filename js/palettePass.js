import { makePassFBO, makePass } from "./utils.js";

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default (regl, {}, input) => {
  const output = makePassFBO(regl);
  return makePass(
    output,
    regl({
      frag: `
      precision mediump float;
      #define PI 3.14159265359

      uniform sampler2D tex;
      uniform sampler2D palette;
      uniform float ditherMagnitude;
      uniform float time;
      varying vec2 vUV;

      highp float rand( const in vec2 uv, const in float t ) {
        const highp float a = 12.9898, b = 78.233, c = 43758.5453;
        highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
        return fract(sin(sn) * c + t);
      }

      void main() {
        float at = texture2D( tex, vUV ).r - rand( gl_FragCoord.xy, time ) * ditherMagnitude;
        gl_FragColor = texture2D( palette, vec2(at, 0.0));
      }
    `,

      uniforms: {
        tex: input,
        ditherMagnitude: 0.05
      },
      framebuffer: output
    })
  );
};
