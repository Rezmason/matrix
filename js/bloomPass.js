import { makePassFBO, makePyramid, resizePyramid } from "./utils.js";

// The bloom pass is basically an added high-pass blur.

const pyramidHeight = 5;
const levelStrengths = Array(pyramidHeight)
  .fill()
  .map((_, index) =>
    Math.pow(index / (pyramidHeight * 2) + 0.5, 1 / 3).toPrecision(5)
  )
  .reverse();

export default (regl, config, input) => {
  if (config.effect === "none") {
    return {
      output: input,
      resize: () => {},
      render: () => {}
    };
  }

  const highPassPyramid = makePyramid(regl, pyramidHeight);
  const horizontalBlurPyramid = makePyramid(regl, pyramidHeight);
  const verticalBlurPyramid = makePyramid(regl, pyramidHeight);
  const output = makePassFBO(regl);

  // The high pass restricts the blur to bright things in our input texture.
  const highPass = regl({
    frag: `
      precision mediump float;
      varying vec2 vUV;
      uniform sampler2D tex;
      uniform float highPassThreshold;
      void main() {
        float value = texture2D(tex, vUV).r;
        if (value < highPassThreshold) {
          value = 0.;
        }
        gl_FragColor = vec4(vec3(value), 1.0);
      }
    `,
    uniforms: {
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
      varying vec2 vUV;
      uniform sampler2D tex;
      uniform vec2 direction;
      uniform float width, height;
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
      tex: regl.prop("tex"),
      direction: regl.prop("direction"),
      height: regl.context("viewportWidth"),
      width: regl.context("viewportHeight")
    },
    framebuffer: regl.prop("fbo")
  });

  // The pyramid of textures gets flattened onto the source texture.
  const combineBloom = regl({
    frag: `
      precision mediump float;
      varying vec2 vUV;
      ${verticalBlurPyramid
        .map((_, index) => `uniform sampler2D tex_${index};`)
        .join("\n")}
      uniform sampler2D tex;
      uniform float bloomStrength;
      void main() {
        vec4 total = vec4(0.);
        ${verticalBlurPyramid
          .map(
            (_, index) =>
              `total += texture2D(tex_${index}, vUV) * ${levelStrengths[index]};`
          )
          .join("\n")}
        gl_FragColor = total * bloomStrength + texture2D(tex, vUV);
      }
    `,
    uniforms: Object.assign(
      {
        tex: input
      },
      Object.fromEntries(
        verticalBlurPyramid.map((fbo, index) => [`tex_${index}`, fbo])
      )
    ),
    framebuffer: output
  });

  return {
    output,
    resize: (viewportWidth, viewportHeight) => {
      // The blur pyramids can be lower resolution than the screen.
      resizePyramid(
        highPassPyramid,
        viewportWidth,
        viewportHeight,
        config.bloomSize
      );
      resizePyramid(
        horizontalBlurPyramid,
        viewportWidth,
        viewportHeight,
        config.bloomSize
      );
      resizePyramid(
        verticalBlurPyramid,
        viewportWidth,
        viewportHeight,
        config.bloomSize
      );
      output.resize(viewportWidth, viewportHeight);
    },
    render: () => {
      highPassPyramid.forEach(fbo => highPass({ fbo, tex: input }));
      horizontalBlurPyramid.forEach((fbo, index) =>
        blur({ fbo, tex: highPassPyramid[index], direction: [1, 0] })
      );
      verticalBlurPyramid.forEach((fbo, index) =>
        blur({
          fbo,
          tex: horizontalBlurPyramid[index],
          direction: [0, 1]
        })
      );
      combineBloom();
    }
  };
};
