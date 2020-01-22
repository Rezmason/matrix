const fonts = {
  coptic: {
    glyphTexURL: "coptic_msdf.png",
    glyphSequenceLength: 32,
    numFontColumns: 8
  },
  gothic: {
    glyphTexURL: "gothic_msdf.png",
    glyphSequenceLength: 27,
    numFontColumns: 8
  },
  matrixcode: {
    glyphTexURL: "matrixcode_msdf.png",
    glyphSequenceLength: 57,
    numFontColumns: 8
  }
};

const versions = {
  paradise: {
    ...fonts.coptic,
    bloomRadius: 1.15,
    bloomStrength: 1.75,
    highPassThreshold: 0,
    cycleSpeed: 0.05,
    cycleStyleName: "cycleFasterWhenDimmed",
    cursorEffectThreshold: 1,
    brightnessOffset: 0.0,
    brightnessMultiplier: 1.0,
    fallSpeed: 0.05,
    glyphEdgeCrop: 0.0,
    glyphHeightToWidth: 1,
    hasSun: true,
    hasThunder: false,
    isPolar: true,
    rippleTypeName: "circle",
    rippleThickness: 0.2,
    rippleScale: 30,
    rippleSpeed: 0.1,
    numColumns: 30,
    palette: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.52, 0.17, 0.05], at: 0.4 },
      { rgb: [0.82, 0.37, 0.12], at: 0.7 },
      { rgb: [1.0, 0.74, 0.29], at: 0.9 },
      { rgb: [1.0, 0.9, 0.8], at: 1.0 }
    ],
    raindropLength: 0.5,
    slant: 0
  },
  nightmare: {
    ...fonts.gothic,
    bloomRadius: 0.8,
    bloomStrength: 1,
    highPassThreshold: 0.7,
    cycleSpeed: 1,
    cycleStyleName: "cycleFasterWhenDimmed",
    cursorEffectThreshold: 1,
    brightnessOffset: 0.0,
    brightnessMultiplier: 1.0,
    fallSpeed: 2.0,
    glyphEdgeCrop: 0.0,
    glyphHeightToWidth: 1,
    hasSun: false,
    hasThunder: true,
    isPolar: false,
    rippleTypeName: null,
    rippleThickness: 0.2,
    rippleScale: 30,
    rippleSpeed: 0.2,
    numColumns: 60,
    palette: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.32, 0.06, 0.0], at: 0.2 },
      { rgb: [0.82, 0.06, 0.05], at: 0.4 },
      { rgb: [1.0, 0.6, 0.3], at: 0.8 },
      { rgb: [1.0, 1.0, 0.9], at: 1.0 }
    ],
    raindropLength: 0.6,
    slant: 360 / 16
  },
  classic: {
    ...fonts.matrixcode,
    bloomRadius: 0.5,
    bloomStrength: 1,
    highPassThreshold: 0.3,
    cycleSpeed: 1,
    cycleStyleName: "cycleFasterWhenDimmed",
    cursorEffectThreshold: 1,
    brightnessOffset: 0.0,
    brightnessMultiplier: 1.0,
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
    palette: [
      { rgb: [0 / 255, 0 / 255, 0 / 255], at: 0 / 16 },
      { rgb: [6 / 255, 16 / 255, 8 / 255], at: 1 / 16 },
      { rgb: [11 / 255, 28 / 255, 15 / 255], at: 2 / 16 },
      { rgb: [17 / 255, 41 / 255, 23 / 255], at: 3 / 16 },
      { rgb: [20 / 255, 58 / 255, 31 / 255], at: 4 / 16 },
      { rgb: [23 / 255, 84 / 255, 39 / 255], at: 5 / 16 },
      { rgb: [30 / 255, 113 / 255, 48 / 255], at: 6 / 16 },
      { rgb: [43 / 255, 142 / 255, 60 / 255], at: 7 / 16 },
      { rgb: [57 / 255, 160 / 255, 72 / 255], at: 8 / 16 },
      { rgb: [70 / 255, 175 / 255, 81 / 255], at: 9 / 16 },
      { rgb: [75 / 255, 187 / 255, 85 / 255], at: 10 / 16 },
      { rgb: [78 / 255, 196 / 255, 91 / 255], at: 11 / 16 },
      { rgb: [83 / 255, 203 / 255, 102 / 255], at: 12 / 16 },
      { rgb: [92 / 255, 212 / 255, 114 / 255], at: 13 / 16 },
      { rgb: [109 / 255, 223 / 255, 130 / 255], at: 14 / 16 },
      { rgb: [129 / 255, 232 / 255, 148 / 255], at: 15 / 16 },
      { rgb: [140 / 255, 235 / 255, 157 / 255], at: 16 / 16 }
    ],
    raindropLength: 1,
    slant: 0
  },
  operator: {
    ...fonts.matrixcode,
    bloomRadius: 0.3,
    bloomStrength: 0.75,
    highPassThreshold: 0.0,
    cycleSpeed: 0.05,
    cycleStyleName: "cycleRandomly",
    cursorEffectThreshold: 0.466,
    brightnessOffset: 0.25,
    brightnessMultiplier: 0.0,
    fallSpeed: 0.65,
    glyphEdgeCrop: 0.15,
    glyphHeightToWidth: 1.35,
    hasSun: false,
    hasThunder: false,
    isPolar: false,
    rippleTypeName: "box",
    rippleThickness: 0.2,
    rippleScale: 30,
    rippleSpeed: 0.2,
    numColumns: 108,
    palette: [
      { rgb: [0.0, 0.0, 0.0], at: 0.0 },
      { rgb: [0.18, 0.9, 0.35], at: 0.6 },
      { rgb: [0.9, 1.0, 0.9], at: 1.0 }
    ],
    raindropLength: 1.5,
    slant: 0
  }
};
versions.throwback = versions.operator;
versions["1999"] = versions.classic;

export default (searchString, makePaletteTexture) => {
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
  config.brightnessChangeBias =
    config.animationSpeed * config.fallSpeed == 0
      ? 1
      : Math.min(1, Math.abs(config.animationSpeed * config.fallSpeed));
  config.backgroundImage = getParam(
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
  const sortedEntries = version.palette
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

  config.paletteColorData = makePaletteTexture(
    paletteColors.flat().map(i => i * 0xff)
  );

  let stripeColors = [0, 0, 0];

  if (config.effect === "pride") {
    config.effect = "stripes";
    config.customStripes = [
      [1, 0, 0],
      [1, 0.5, 0],
      [1, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.8, 0, 1]
    ].flat();
  }

  if (config.effect === "customStripes" || config.effect === "stripes") {
    const numFlagColors = Math.floor(config.customStripes.length / 3);
    stripeColors = config.customStripes.slice(0, numFlagColors * 3);
  }

  config.stripeColorData = makePaletteTexture(
    stripeColors.map(f => Math.floor(f * 0xff))
  );

  const uniforms = Object.fromEntries(
    Object.entries(config).filter(([key, value]) => {
      const type = typeof (Array.isArray(value) ? value[0] : value);
      return type !== "string" && type !== "object";
    })
  );

  return [config, uniforms];
};
