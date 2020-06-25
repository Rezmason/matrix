import { make1DTexture, makePassFBO, makePass } from "./utils.js";

const neapolitanStripeColors = [
  [0.4, 0.15, 0.1],
  [0.4, 0.15, 0.1],
  [0.8, 0.8, 0.6],
  [0.8, 0.8, 0.6],
  [1.0, 0.7, 0.8],
  [1.0, 0.7, 0.8]
].flat();

const prideStripeColors = [
  [1, 0, 0],
  [1, 0.5, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [0.8, 0, 1]
].flat();

export default (regl, config, inputs) => {
  const output = makePassFBO(regl);

  const stripeColors =
    "stripeColors" in config
      ? config.stripeColors.split(",").map(parseFloat)
      : config.effect === "pride"
      ? prideStripeColors
      : neapolitanStripeColors;
  const numStripeColors = Math.floor(stripeColors.length / 3);
  const stripes = make1DTexture(
    regl,
    stripeColors.slice(0, numStripeColors * 3).map(f => Math.floor(f * 0xff))
  );

  return makePass(
    {
      primary: output
    },
    regl({
      frag: `
      precision mediump float;
      #define PI 3.14159265359

      uniform sampler2D tex;
      uniform sampler2D bloomTex;
      uniform sampler2D stripes;
      uniform float ditherMagnitude;
      uniform float time;
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
        gl_FragColor = vec4(color * at, 1.0);
      }
    `,

      uniforms: {
        tex: inputs.primary,
        bloomTex: inputs.bloom,
        stripes,
        ditherMagnitude: 0.05
      },
      framebuffer: output
    })
  );
};
