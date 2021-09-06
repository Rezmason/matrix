const fonts = {
  coptic: {
    glyphTexURL: "coptic_msdf.png",
    glyphSequenceLength: 32,
    glyphTextureColumns: 8
  },
  gothic: {
    glyphTexURL: "gothic_msdf.png",
    glyphSequenceLength: 27,
    glyphTextureColumns: 8
  },
  matrixcode: {
    glyphTexURL: "matrixcode_msdf.png",
    glyphSequenceLength: 57,
    glyphTextureColumns: 8
  }
};

const defaults = {
  animationSpeed: 1,
  forwardSpeed: 0.25,
  bloomStrength: 1,
  bloomSize: 1,
  highPassThreshold: 0.3,
  cycleSpeed: 1,
  cycleStyleName: "cycleFasterWhenDimmed",
  cursorEffectThreshold: 1,
  brightnessOffset: 0.0,
  brightnessMultiplier: 1.0,
  brightnessMix: 1.0,
  brightnessMinimum: 0,
  fallSpeed: 1,
  glyphEdgeCrop: 0.0,
  glyphHeightToWidth: 1,
  hasSun: false,
  hasThunder: false,
  isPolar: false,
  rippleTypeName: null,
  rippleThickness: 0.2,
  rippleScale: 30,
  rippleSpeed: 0.2,
  numColumns: 80,
  density: 1,
  paletteEntries: [
    { rgb: [0.0, 0.0, 0.0], at: 0.0 },
    { rgb: [0.09, 0.33, 0.04], at: 0.25 },
    { rgb: [0.39, 0.98, 0.38], at: 0.7 },
    { rgb: [0.57, 0.97, 0.61], at: 1.0 }
  ],
  raindropLength: 1,
  slant: 0,
  resolution: 1,
  useHalfFloat: false,
};

const versions = {
  classic: {
    ...defaults,
    ...fonts.matrixcode
  },
  operator: {
    ...defaults,
    ...fonts.matrixcode,
    bloomStrength: 0.75,
    highPassThreshold: 0.0,
    cycleSpeed: 0.05,
    cycleStyleName: "cycleRandomly",
    cursorEffectThreshold: 0.64,
    brightnessOffset: 0.25,
    brightnessMultiplier: 0.0,
    brightnessMinimum: -1.0,
    fallSpeed: 0.65,
    glyphEdgeCrop: 0.15,
    glyphHeightToWidth: 1.35,
    rippleTypeName: "box",
    numColumns: 108,
    paletteEntries: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.18, 0.9, 0.35], at: 0.6 },
      { rgb: [0.9, 1.0, 0.9], at: 1.0 }
    ],
    raindropLength: 1.5
  },
  nightmare: {
    ...defaults,
    ...fonts.gothic,
    highPassThreshold: 0.7,
    brightnessMix: 0.75,
    fallSpeed: 2.0,
    hasThunder: true,
    numColumns: 60,
    paletteEntries: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.32, 0.06, 0.0], at: 0.2 },
      { rgb: [0.82, 0.06, 0.05], at: 0.4 },
      { rgb: [1.0, 0.6, 0.3], at: 0.8 },
      { rgb: [1.0, 1.0, 0.9], at: 1.0 }
    ],
    raindropLength: 0.6,
    slant: (22.5 * Math.PI) / 180
  },
  paradise: {
    ...defaults,
    ...fonts.coptic,
    bloomStrength: 1.75,
    highPassThreshold: 0,
    cycleSpeed: 0.1,
    brightnessMix: 0.05,
    fallSpeed: 0.08,
    hasSun: true,
    isPolar: true,
    rippleTypeName: "circle",
    rippleSpeed: 0.1,
    numColumns: 30,
    paletteEntries: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.52, 0.17, 0.05], at: 0.4 },
      { rgb: [0.82, 0.37, 0.12], at: 0.7 },
      { rgb: [1.0, 0.74, 0.29], at: 0.9 },
      { rgb: [1.0, 0.9, 0.8], at: 1.0 }
    ],
    raindropLength: 0.4
  }
};
versions.throwback = versions.operator;
versions["1999"] = versions.classic;

const range = (f, min = -Infinity, max = Infinity) =>
  Math.max(min, Math.min(max, f));
const nullNaN = f => (isNaN(f) ? null : f);

const paramMapping = {
  version: { key: "version", parser: s => s },
  effect: { key: "effect", parser: s => s },
  width: { key: "numColumns", parser: s => nullNaN(parseInt(s)) },
  numColumns: { key: "numColumns", parser: s => nullNaN(parseInt(s)) },
  density: { key: "density", parser: s => nullNaN(range(parseFloat(s), 0)) },
  resolution: { key: "resolution", parser: s => nullNaN(parseFloat(s)) },
  animationSpeed: {
    key: "animationSpeed",
    parser: s => nullNaN(parseFloat(s))
  },
  forwardSpeed: {
    key: "forwardSpeed",
    parser: s => nullNaN(parseFloat(s))
  },
  cycleSpeed: { key: "cycleSpeed", parser: s => nullNaN(parseFloat(s)) },
  fallSpeed: { key: "fallSpeed", parser: s => nullNaN(parseFloat(s)) },
  raindropLength: {
    key: "raindropLength",
    parser: s => nullNaN(parseFloat(s))
  },
  slant: {
    key: "slant",
    parser: s => nullNaN((parseFloat(s) * Math.PI) / 180)
  },
  bloomSize: {
    key: "bloomSize",
    parser: s => nullNaN(range(parseFloat(s), 0, 1))
  },
  url: { key: "bgURL", parser: s => s },
  colors: { key: "stripeColors", parser: s => s }
};
paramMapping.dropLength = paramMapping.raindropLength;
paramMapping.angle = paramMapping.slant;

export default (searchString, make1DTexture) => {
  const urlParams = Object.fromEntries(
    Array.from(new URLSearchParams(searchString).entries())
      .filter(([key]) => key in paramMapping)
      .map(([key, value]) => [
        paramMapping[key].key,
        paramMapping[key].parser(value)
      ])
      .filter(([_, value]) => value != null)
  );

  const version =
    urlParams.version in versions
      ? versions[urlParams.version]
      : versions.classic;

  return {
    ...version,
    ...urlParams
  };
};
