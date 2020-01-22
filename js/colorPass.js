import { makePassFBO, makePass } from "./utils.js";

const colorizeByPalette = (regl, uniforms, framebuffer) =>
  // The rendered texture's values are mapped to colors in a palette texture.
  // A little noise is introduced, to hide the banding that appears
  // in subtle gradients. The noise is also time-driven, so its grain
  // won't persist across subsequent frames. This is a safe trick
  // in screen space.
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
      ...uniforms,
      ditherMagnitude: 0.05
    },
    framebuffer
  });

const colorizeByStripes = (regl, uniforms, framebuffer) =>
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
      ...uniforms,
      ditherMagnitude: 0.1
    },
    framebuffer
  });

const colorizeByImage = (regl, uniforms, framebuffer) =>
  regl({
    frag: `
    precision mediump float;
    uniform sampler2D tex;
    uniform sampler2D bgTex;
    varying vec2 vUV;

    void main() {
      vec3 bgColor = texture2D(bgTex, vUV).rgb;
      float brightness = pow(texture2D(tex, vUV).r, 1.5);
      gl_FragColor = vec4(bgColor * brightness, 1.0);
    }
  `,
    uniforms,
    framebuffer
  });

const colorizersByEffect = {
  plain: colorizeByPalette,
  customStripes: colorizeByStripes,
  stripes: colorizeByStripes,
  image: colorizeByImage
};

export default (regl, config, { bgTex }, input) => {
  if (config.effect === "none") {
    return makePass(input, null, null);
  }

  if (bgTex == null) {
    bgTex = 0;
  }

  const output = makePassFBO(regl);

  return makePass(
    output,
    (config.effect in colorizersByEffect
      ? colorizersByEffect[config.effect]
      : colorizeByPalette)(regl, { bgTex, tex: input }, output)
  );
};
