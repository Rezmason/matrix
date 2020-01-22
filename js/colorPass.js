import { makePassFBO } from "./utils.js";

// rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

const colorizeByPalette = regl =>
  regl({
    frag: `
    precision mediump float;
    #define PI 3.14159265359

    uniform sampler2D tex;
    uniform sampler2D paletteColorData;
    uniform float ditherMagnitude;
    uniform float time;
    varying vec2 vUV;

    highp float rand( const in vec2 uv, const in float t ) {
      const highp float a = 12.9898, b = 78.233, c = 43758.5453;
      highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
      return fract(sin(sn) * c + t);
    }

    void main() {
      gl_FragColor = texture2D( paletteColorData, vec2( texture2D( tex, vUV ).r - rand( gl_FragCoord.xy, time ) * ditherMagnitude, 0.0 ) );
    }
  `,

    uniforms: {
      ditherMagnitude: 0.05
    }
  });

const colorizeByStripes = regl =>
  regl({
    frag: `
    precision mediump float;
    #define PI 3.14159265359

    uniform sampler2D tex;
    uniform sampler2D stripeColorData;
    uniform float ditherMagnitude;
    varying vec2 vUV;

    highp float rand( const in vec2 uv ) {
      const highp float a = 12.9898, b = 78.233, c = 43758.5453;
      highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
      return fract(sin(sn) * c);
    }

    void main() {
      float value = texture2D(tex, vUV).r;
      vec3 value2 = texture2D(stripeColorData, vUV).rgb - rand( gl_FragCoord.xy ) * ditherMagnitude;
      gl_FragColor = vec4(value2 * value, 1.0);
    }
  `,

    uniforms: {
      ditherMagnitude: 0.1
    }
  });

const colorizeByImage = (regl, bgTex) =>
  regl({
    frag: `
    precision mediump float;
    uniform sampler2D tex;
    uniform sampler2D bgTex;
    varying vec2 vUV;

    void main() {
      gl_FragColor = vec4(texture2D(bgTex, vUV).rgb * (pow(texture2D(tex, vUV).r, 1.5) * 0.995 + 0.005), 1.0);
    }
  `,
    uniforms: {
      bgTex
    }
  });

const colorizersByEffect = {
  plain: colorizeByPalette,
  customStripes: colorizeByStripes,
  stripes: colorizeByStripes,
  image: colorizeByImage
};

export default (regl, config, { bgTex }, input) => {
  if (config.effect === "none") {
    return {
      output: input,
      resize: () => {},
      render: () => {}
    };
  }

  const output = makePassFBO(regl);

  const colorize = regl({
    uniforms: {
      tex: regl.prop("tex")
    },
    framebuffer: output
  });

  const colorizer = (config.effect in colorizersByEffect
    ? colorizersByEffect[config.effect]
    : colorizeByPalette)(regl, bgTex);

  return {
    output,
    resize: output.resize,
    render: resources => {
      colorize(
        {
          tex: input
        },
        () => colorizer(resources)
      );
    }
  };
};
