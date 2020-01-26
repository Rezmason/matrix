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
  bloomRadius: 0.5,
  bloomStrength: 1,
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
  paletteEntries: [
    { rgb: [0.0, 0.0, 0.0], at: 0.0 },
    { rgb: [0.023, 0.062, 0.031], at: 0.0625 },
    { rgb: [0.043, 0.109, 0.058], at: 0.125 },
    { rgb: [0.066, 0.16, 0.09], at: 0.1875 },
    { rgb: [0.078, 0.227, 0.121], at: 0.25 },
    { rgb: [0.09, 0.329, 0.152], at: 0.3125 },
    { rgb: [0.117, 0.443, 0.188], at: 0.375 },
    { rgb: [0.168, 0.556, 0.235], at: 0.4375 },
    { rgb: [0.223, 0.627, 0.282], at: 0.5 },
    { rgb: [0.274, 0.686, 0.317], at: 0.5625 },
    { rgb: [0.294, 0.733, 0.333], at: 0.625 },
    { rgb: [0.305, 0.768, 0.356], at: 0.6875 },
    { rgb: [0.325, 0.796, 0.4], at: 0.75 },
    { rgb: [0.36, 0.831, 0.447], at: 0.8125 },
    { rgb: [0.427, 0.874, 0.509], at: 0.875 },
    { rgb: [0.505, 0.909, 0.58], at: 0.9375 },
    { rgb: [0.549, 0.921, 0.615], at: 1.0 }
  ],
  raindropLength: 1,
  slant: 0
};

const versions = {
  classic: {
    ...defaults,
    ...fonts.matrixcode
  },
  operator: {
    ...defaults,
    ...fonts.matrixcode,
    bloomRadius: 0.3,
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
    bloomRadius: 0.8,
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
    slant: 360 / 16
  },
  paradise: {
    ...defaults,
    ...fonts.coptic,
    bloomRadius: 1.15,
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

export default (searchString, make1DTexture) => {
  const urlParams = new URLSearchParams(searchString);
  const getParam = (keyOrKeys, defaultValue) => {
    if (Array.isArray(keyOrKeys)) {
      const keys = keyOrKeys;
      const key = keys.find(key => urlParams.has(key));
      return key != null ? urlParams.get(key) : defaultValue;
    } else {
      const key = keyOrKeys;
      return urlParams.has(key) ? urlParams.get(key) : defaultValue;
    }
  };

  const versionName = getParam("version", "classic");
  const version =
    versions[versionName] == null ? versions.classic : versions[versionName];

  const config = { ...version };

  config.animationSpeed = parseFloat(getParam("animationSpeed", 1));
  config.fallSpeed *= parseFloat(getParam("fallSpeed", 1));
  config.cycleSpeed *= parseFloat(getParam("cycleSpeed", 1));
  config.numColumns = parseInt(getParam("width", config.numColumns));
  config.raindropLength = parseFloat(
    getParam(["raindropLength", "dropLength"], config.raindropLength)
  );
  config.glyphSequenceLength = config.glyphSequenceLength;
  config.slant =
    (parseFloat(getParam(["slant", "angle"], config.slant)) * Math.PI) / 180;
  config.slantVec = [Math.cos(config.slant), Math.sin(config.slant)];
  config.slantScale =
    1 / (Math.abs(Math.sin(2 * config.slant)) * (Math.sqrt(2) - 1) + 1);
  config.glyphEdgeCrop = parseFloat(getParam("encroach", config.glyphEdgeCrop));
  config.glyphHeightToWidth = parseFloat(
    getParam("stretch", config.glyphHeightToWidth)
  );
  config.cursorEffectThreshold = getParam(
    "cursorEffectThreshold",
    config.cursorEffectThreshold
  );
  config.bloomSize = Math.max(
    0.01,
    Math.min(1, parseFloat(getParam("bloomSize", 0.5)))
  );
  config.effect = getParam("effect", "plain");
  config.bgURL = getParam(
    "url",
    "https://upload.wikimedia.org/wikipedia/commons/0/0a/Flammarion_Colored.jpg"
  );
  config.customStripes = getParam(
    "colors",
    "0.4,0.15,0.1,0.4,0.15,0.1,0.8,0.8,0.6,0.8,0.8,0.6,1.0,0.7,0.8,1.0,0.7,0.8,"
  )
    .split(",")
    .map(parseFloat);
  config.showComputationTexture = config.effect === "none";

  switch (config.cycleStyleName) {
    case "cycleFasterWhenDimmed":
      config.cycleStyle = 0;
      break;
    case "cycleRandomly":
    default:
      config.cycleStyle = 1;
      break;
  }

  switch (config.rippleTypeName) {
    case "box":
      config.rippleType = 0;
      break;
    case "circle":
      config.rippleType = 1;
      break;
    default:
      config.rippleType = -1;
  }

  const PALETTE_SIZE = 2048;
  const paletteColors = Array(PALETTE_SIZE);
  const sortedEntries = version.paletteEntries
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

  config.palette = make1DTexture(paletteColors.flat().map(i => i * 0xff));

  let stripeColors = [0, 0, 0];

  if (config.effect === "pride") {
    config.effect = "stripes";
    config.stripeColors = [
      [1, 0, 0],
      [1, 0.5, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.8, 0, 1]
    ].flat();
  }

  if (config.effect === "customStripes" || config.effect === "stripes") {
    config.effect = "stripes";
    const numStripeColors = Math.floor(config.stripeColors.length / 3);
    stripeColors = config.stripeColors.slice(0, numStripeColors * 3);
  }

  config.stripes = make1DTexture(stripeColors.map(f => Math.floor(f * 0xff)));

  const uniforms = Object.fromEntries(
    Object.entries(config).filter(([key, value]) => {
      const type = typeof (Array.isArray(value) ? value[0] : value);
      return type !== "string" && type !== "object";
    })
  );

  return [config, uniforms];
};
