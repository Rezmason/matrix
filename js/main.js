import { makeFullScreenQuad, makePipeline } from "./utils.js";
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
  customStripes: makeStripePass,
  stripes: makeStripePass,
  pride: makeStripePass,
  image: makeImagePass
};

const config = makeConfig(window.location.search);
const resolution = config.resolution;
const effect = config.effect in effects ? config.effect : "plain";

const resize = () => {
  canvas.width = Math.ceil(canvas.clientWidth * resolution);
  canvas.height = Math.ceil(canvas.clientHeight * resolution);
};
window.onresize = resize;
resize();

const dimensions = { width: 1, height: 1 };

document.body.onload = async () => {
  // All this takes place in a full screen quad.
  const fullScreenQuad = makeFullScreenQuad(regl);
  const pipeline = makePipeline(
    [
      makeMatrixRenderer,
      effect === "none" ? null : makeBloomPass,
      effects[effect]
    ],
    p => p.outputs,
    regl,
    config
  );
  const drawToScreen = regl({
    uniforms: {
      tex: pipeline[pipeline.length - 1].outputs.primary
    }
  });
  await Promise.all(pipeline.map(({ ready }) => ready));
  const tick = regl.frame(({ viewportWidth, viewportHeight }) => {
    // tick.cancel();
    if (
      dimensions.width !== viewportWidth ||
      dimensions.height !== viewportHeight
    ) {
      dimensions.width = viewportWidth;
      dimensions.height = viewportHeight;
      for (const pass of pipeline) {
        pass.resize(viewportWidth, viewportHeight);
      }
    }
    fullScreenQuad(() => {
      for (const pass of pipeline) {
        pass.render();
      }
      drawToScreen();
    });
  });
};
