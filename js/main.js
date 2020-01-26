import { makeFullScreenQuad, make1DTexture, makePipeline } from "./utils.js";
import makeConfig from "./config.js";
import makeMatrixRenderer from "./renderer.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";
import makeStripePass from "./stripePass.js";
import makeImagePass from "./imagePass.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", e => e.preventDefault(), {
  passive: false
});

const regl = createREGL({
  canvas,
  extensions: ["OES_texture_half_float", "OES_texture_half_float_linear"],
  // These extensions are also needed, but Safari misreports that they are missing
  optionalExtensions: [
    "EXT_color_buffer_half_float",
    "WEBGL_color_buffer_float",
    "OES_standard_derivatives"
  ]
});

const effects = {
  none: null,
  plain: makePalettePass,
  stripes: makeStripePass,
  image: makeImagePass
};

const [config, uniforms] = makeConfig(window.location.search, data =>
  make1DTexture(regl, data)
);
const effect = config.effect in effects ? config.effect : "plain";

const resize = () => {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
};
window.onresize = resize;
resize();

document.body.onload = async () => {
  // All this takes place in a full screen quad.
  const fullScreenQuad = makeFullScreenQuad(regl, uniforms);
  const pipeline = makePipeline(
    [
      makeMatrixRenderer,
      effect === "none" ? null : makeBloomPass,
      effects[effect]
    ],
    p => p.output,
    regl,
    config
  );
  const drawToScreen = regl({
    uniforms: {
      tex: pipeline[pipeline.length - 1].output
    }
  });
  await Promise.all(pipeline.map(({ ready }) => ready));
  regl.frame(({ viewportWidth, viewportHeight }) => {
    pipeline.forEach(({ resize }) => resize(viewportWidth, viewportHeight));
    fullScreenQuad(() => {
      pipeline.forEach(({ render }) => render());
      drawToScreen();
    });
  });
};
