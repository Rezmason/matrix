import { loadImage, makePassFBO, makePass } from "./utils.js";

export default (regl, { bgURL }, input) => {
  const output = makePassFBO(regl);
  const bgLoader = loadImage(regl, bgURL);
  return makePass(
    output,
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
      uniforms: { bgTex: bgLoader.texture, tex: input },
      framebuffer: output
    }),
    null,
    bgLoader.ready
  );
};
