import { make1DTexture, makePassFBO, makePass } from "./utils.js";

const makePalette = (regl, entries) => {
  const PALETTE_SIZE = 2048;
  const paletteColors = Array(PALETTE_SIZE);
  const sortedEntries = entries
    .slice()
    .sort((e1, e2) => e1.at - e2.at)
    .map(entry => ({
      rgb: entry.rgb,
      arrayIndex: Math.floor(
        Math.max(Math.min(1, entry.at), 0) * (PALETTE_SIZE - 1)
      )
    }));
  sortedEntries.unshift({ rgb: sortedEntries[0].rgb, arrayIndex: 0 });
  sortedEntries.push({
    rgb: sortedEntries[sortedEntries.length - 1].rgb,
    arrayIndex: PALETTE_SIZE - 1
  });
  sortedEntries.forEach((entry, index) => {
    paletteColors[entry.arrayIndex] = entry.rgb.slice();
    if (index + 1 < sortedEntries.length) {
      const nextEntry = sortedEntries[index + 1];
      const diff = nextEntry.arrayIndex - entry.arrayIndex;
      for (let i = 0; i < diff; i++) {
        const ratio = i / diff;
        paletteColors[entry.arrayIndex + i] = [
          entry.rgb[0] * (1 - ratio) + nextEntry.rgb[0] * ratio,
          entry.rgb[1] * (1 - ratio) + nextEntry.rgb[1] * ratio,
          entry.rgb[2] * (1 - ratio) + nextEntry.rgb[2] * ratio
        ];
      }
    }
  });

  return make1DTexture(
    regl,
    paletteColors.flat().map(i => i * 0xff)
  );
};

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default (regl, config, inputs) => {
  const output = makePassFBO(regl);
  const palette = makePalette(regl, config.paletteEntries);

  return makePass(
    {
      primary: output
    },
    regl({
      frag: `
      precision mediump float;
      #define PI 3.14159265359

      uniform sampler2D tex;
      uniform sampler2D bloomTex;
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
        float brightness = texture2D( tex, vUV ).r + texture2D( bloomTex, vUV ).r;
        float at = brightness - rand( gl_FragCoord.xy, time ) * ditherMagnitude;
        gl_FragColor = texture2D( palette, vec2(at, 0.0));
      }
    `,

      uniforms: {
        tex: inputs.primary,
        bloomTex: inputs.bloom,
        palette,
        ditherMagnitude: 0.05
      },
      framebuffer: output
    })
  );
};
