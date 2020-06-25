import { loadImage, makePassFBO, makePass } from "./utils.js";

const defaultBGURL =
  "https://upload.wikimedia.org/wikipedia/commons/0/0a/Flammarion_Colored.jpg";

export default (regl, config, inputs) => {
  const output = makePassFBO(regl);
  const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
  const bgLoader = loadImage(regl, bgURL);
  return makePass(
    {
      primary: output
    },
    regl({
      frag: `
        precision mediump float;
        uniform sampler2D tex;
        uniform sampler2D bloomTex;
        uniform sampler2D bgTex;
        varying vec2 vUV;

        void main() {
          vec3 bgColor = texture2D(bgTex, vUV).rgb;
          float brightness = pow(min(1., texture2D(tex, vUV).r * 2.) + texture2D(bloomTex, vUV).r, 1.5);
          gl_FragColor = vec4(bgColor * brightness, 1.0);
        }
      `,
      uniforms: {
        bgTex: bgLoader.texture,
        tex: inputs.primary,
        bloomTex: inputs.bloom
      },
      framebuffer: output
    }),
    null,
    bgLoader.ready
  );
};
