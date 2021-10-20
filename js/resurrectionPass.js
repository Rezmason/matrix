import { loadText, extractEntries, make1DTexture, makePassFBO, makePass } from "./utils.js";

const colorToRGB = ([hue, saturation, lightness]) => {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n) => {
    const k = (n + hue * 12) % 12;
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};

export default (regl, config, inputs) => {
  const output = makePassFBO(regl, config.useHalfFloat);

  const resurrectionPassFrag = loadText("../shaders/resurrectionPass.frag");

  const render = regl({
    frag: regl.prop("frag"),

    uniforms: {
      ...extractEntries(config, [
        "backgroundColor",
      ]),
      tex: inputs.primary,
      bloomTex: inputs.bloom,
      ditherMagnitude: 0.05
    },
    framebuffer: output
  });

  return makePass(
    {
      primary: output
    },
    () => render({frag: resurrectionPassFrag.text() })
  );
};
