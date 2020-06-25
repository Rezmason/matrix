import {
  extractEntries,
  makePassFBO,
  makePyramid,
  resizePyramid,
  makePass
} from "./utils.js";

// The bloom pass is basically an added high-pass blur.

const pyramidHeight = 5;
const levelStrengths = Array(pyramidHeight)
  .fill()
  .map((_, index) =>
    Math.pow(index / (pyramidHeight * 2) + 0.5, 1 / 3).toPrecision(5)
  )
  .reverse();

export default (regl, config, inputs) => {
  const uniforms = extractEntries(config, [
    "bloomStrength",
    "highPassThreshold"
  ]);

  const highPassPyramid = makePyramid(regl, pyramidHeight);
  const hBlurPyramid = makePyramid(regl, pyramidHeight);
  const vBlurPyramid = makePyramid(regl, pyramidHeight);
  const output = makePassFBO(regl);

  // The high pass restricts the blur to bright things in our input texture.
  const highPass = regl({
    frag: `
      #define lumaMag vec3(0.2126, 0.7152, 0.0722)
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D tex;
      uniform float highPassThreshold;
      void main() {
        vec3 lumaColor = texture2D(tex, vUV).rgb * lumaMag;
        float luma = lumaColor.r + lumaColor.g + lumaColor.b;
        if (luma < highPassThreshold) {
          luma = 0.;
        }
        gl_FragColor = vec4(vec3(luma), 1.0);
      }
    `,
    uniforms: {
      ...uniforms,
      tex: regl.prop("tex")
    },
    framebuffer: regl.prop("fbo")
  });

  // A 2D gaussian blur is just a 1D blur done horizontally, then done vertically.
  // The FBO pyramid's levels represent separate levels of detail;
  // by blurring them all, this 3x1 blur approximates a more complex gaussian.
  const blur = regl({
    frag: `
      precision mediump float;
      uniform float width, height;
      uniform sampler2D tex;
      uniform vec2 direction;
      varying vec2 vUV;
      void main() {
        vec2 size = width > height ? vec2(width / height, 1.) : vec2(1., height / width);
        gl_FragColor =
          texture2D(tex, vUV) * 0.442 +
          (
            texture2D(tex, vUV + direction / max(width, height) * size) +
            texture2D(tex, vUV - direction / max(width, height) * size)
          ) * 0.279;
      }
    `,
    uniforms: {
      ...uniforms,
      tex: regl.prop("tex"),
      direction: regl.prop("direction"),
      height: regl.context("viewportWidth"),
      width: regl.context("viewportHeight")
    },
    framebuffer: regl.prop("fbo")
  });

  // The pyramid of textures gets flattened onto the source texture.
  const flattenPyramid = regl({
    frag: `
      precision mediump float;
      varying vec2 vUV;
      ${vBlurPyramid
        .map((_, index) => `uniform sampler2D pyr_${index};`)
        .join("\n")}
      uniform float bloomStrength;
      void main() {
        vec4 total = vec4(0.);
        ${vBlurPyramid
          .map(
            (_, index) =>
              `total += texture2D(pyr_${index}, vUV) * ${levelStrengths[index]};`
          )
          .join("\n")}
        gl_FragColor = total * bloomStrength;
      }
    `,
    uniforms: {
      ...uniforms,
      ...Object.fromEntries(
        vBlurPyramid.map((fbo, index) => [`pyr_${index}`, fbo])
      )
    },
    framebuffer: output
  });

  return makePass(
    {
      primary: inputs.primary,
      bloom: output
    },
    () => {
      highPassPyramid.forEach(fbo => highPass({ fbo, tex: inputs.primary }));
      hBlurPyramid.forEach((fbo, index) =>
        blur({ fbo, tex: highPassPyramid[index], direction: [1, 0] })
      );
      vBlurPyramid.forEach((fbo, index) =>
        blur({ fbo, tex: hBlurPyramid[index], direction: [0, 1] })
      );
      flattenPyramid();
    },
    (w, h) => {
      // The blur pyramids can be lower resolution than the screen.
      resizePyramid(highPassPyramid, w, h, config.bloomSize);
      resizePyramid(hBlurPyramid, w, h, config.bloomSize);
      resizePyramid(vBlurPyramid, w, h, config.bloomSize);
      output.resize(w, h);
    }
  );
};
