const extractEntries = (src, keys) =>
  Object.fromEntries(
    Array.from(Object.entries(src)).filter(([key]) => keys.includes(key))
  );

const makePassTexture = (regl, halfFloat) =>
  regl.texture({
    width: 1,
    height: 1,
    type: halfFloat ? "half float" : "uint8",
    wrap: "clamp",
    min: "linear",
    mag: "linear"
  });

const makePassFBO = (regl, halfFloat) => regl.framebuffer({ color: makePassTexture(regl, halfFloat) });

// A pyramid is just an array of FBOs, where each FBO is half the width
// and half the height of the FBO below it.
const makePyramid = (regl, height, halfFloat) =>
  Array(height)
    .fill()
    .map(_ => makePassFBO(regl, halfFloat));

const makeDoubleBuffer = (regl, props) => {
  const state = Array(2)
    .fill()
    .map(() =>
      regl.framebuffer({
        color: regl.texture(props),
        depthStencil: false
      })
    );
  return {
    front: ({ tick }) => state[tick % 2],
    back: ({ tick }) => state[(tick + 1) % 2]
  };
};

const resizePyramid = (pyramid, vw, vh, scale) =>
  pyramid.forEach((fbo, index) =>
    fbo.resize(
      Math.floor((vw * scale) / 2 ** index),
      Math.floor((vh * scale) / 2 ** index)
    )
  );

const loadImages = async (regl, manifest) => {
  const keys = Object.keys(manifest);
  const urls = Object.values(manifest);
  const images = await Promise.all(urls.map(url => loadImageOld(regl, url)));
  return Object.fromEntries(images.map((image, index) => [keys[index], image]));
};

const loadImageOld = async (regl, url) => {
  if (url == null) {
    return null;
  }
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  return regl.texture({
    data: image,
    mag: "linear",
    min: "linear",
    flipY: true
  });
};

const loadImage = (regl, url) => {
  let texture = regl.texture([[0]]);
  let loaded = false;
  return {
    texture: () => {
      if (!loaded) {
        console.warn(`texture still loading: ${url}`);
      }
      return texture;
    },
    loaded: (async () => {
      if (url != null) {
        const data = new Image();
        data.crossOrigin = "anonymous";
        data.src = url;
        await data.decode();
        loaded = true;
        texture = regl.texture({
          data,
          mag: "linear",
          min: "linear",
          flipY: true
        });
      }
    })()
  };
};

const makeFullScreenQuad = (regl, uniforms = {}, context = {}) =>
  regl({
    vert: `
    precision mediump float;
    attribute vec2 aPosition;
    varying vec2 vUV;
    void main() {
      vUV = 0.5 * (aPosition + 1.0);
      gl_Position = vec4(aPosition, 0, 1);
    }
  `,

    frag: `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D tex;
    void main() {
      gl_FragColor = texture2D(tex, vUV);
    }
  `,

    attributes: {
      aPosition: [-4, -4, 4, -4, 0, 4]
    },
    count: 3,

    uniforms: {
      ...uniforms,
      time: regl.context("time")
    },

    context,

    depth: { enable: false },

  });

const make1DTexture = (regl, data) =>
  regl.texture({
    data,
    width: data.length / 3,
    height: 1,
    format: "rgb",
    mag: "linear",
    min: "linear"
  });

const makePass = (outputs, render, resize, ready) => {
  if (render == null) {
    render = () => {};
  }
  if (resize == null) {
    resize = (w, h) =>
      Object.values(outputs).forEach(output => output.resize(w, h));
  }
  if (ready == null) {
    ready = Promise.resolve();
  }
  return {
    outputs,
    render,
    resize,
    ready
  };
};

const makePipeline = (steps, getInputs, ...params) =>
  steps
    .filter(f => f != null)
    .reduce(
      (pipeline, f, i) => [
        ...pipeline,
        f(...params, i == 0 ? null : getInputs(pipeline[i - 1]))
      ],
      []
    );

export {
  extractEntries,
  makePassTexture,
  makePassFBO,
  makeDoubleBuffer,
  makePyramid,
  resizePyramid,
  loadImage,
  loadImages,
  makeFullScreenQuad,
  make1DTexture,
  makePass,
  makePipeline
};
