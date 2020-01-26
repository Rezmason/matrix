import { makePassFBO, makePass } from "./utils.js";

export default (regl, {}, input) => {
  const output = makePassFBO(regl);
  return makePass(
    output,
    regl({
      frag: `
      precision mediump float;
      #define PI 3.14159265359

      uniform sampler2D tex;
      uniform sampler2D stripes;
      uniform float ditherMagnitude;
      varying vec2 vUV;

      highp float rand( const in vec2 uv ) {
        const highp float a = 12.9898, b = 78.233, c = 43758.5453;
        highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
        return fract(sin(sn) * c);
      }

      void main() {
        vec3 color = texture2D(stripes, vUV).rgb - rand( gl_FragCoord.xy ) * ditherMagnitude;
        float brightness = texture2D(tex, vUV).r;
        gl_FragColor = vec4(color * brightness, 1.0);
      }
    `,

      uniforms: {
        tex: input,
        ditherMagnitude: 0.1
      },
      framebuffer: output
    })
  );
};
