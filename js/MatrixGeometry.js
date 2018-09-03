const makeMatrixGeometry = ({
      numRows, numColumns,
      animationSpeed, fallSpeed, cycleSpeed,
      a, b, c,
      glyphSequenceLength,
    }) => {

    const fTexU = 1 / 8;
    const fTexV = 1 / 8;
    const verticesPerGlyph = 4;

    const glyphPositionTemplate = [[0, 1, 0, 1], [1, 1, 0, 1], [0, 0, 0, 1], [1, 0, 0, 1],];
    const glyphBrightnessTemplate = [0, 0, 0, 0,];
    const glyphUVTemplate = [[0, fTexV], [fTexU, fTexV], [0, 0], [fTexU, 0],];
    const glyphIndexTemplate = [0, 2, 1, 2, 3, 1,];

    const glyphPositionMarch = 4;
    const glyphBrightnessMarch = 1;
    const glyphUVMarch = 2;
    const glyphIndexMarch = 4;

    const glyphPositionArray = [];
    const glyphBrightnessArray = [];
    const glyphUVArray = [];
    const glyphIndexArray = [];

    const fRow = 1 / numRows;
    const fColumn = 1 / numColumns;

    for (let column = 0; column < numColumns; column++) {
      for (let row = 0; row < numRows; row++) {
        const index = row + column * numRows;
        glyphPositionArray.push(...[].concat(...glyphPositionTemplate.map(([x, y, z, w]) => [
          (x + column) / numColumns - 0.5,
          (y + row) / numRows - 0.5,
          z,
          w,
        ])));
        glyphBrightnessArray.push(...glyphBrightnessTemplate);
        glyphUVArray.push(...[].concat(...glyphUVTemplate));
        glyphIndexArray.push(...[].concat(glyphIndexTemplate.map(i => i + index * glyphIndexMarch)));
      }
    }

    const geometry = new THREE.BufferGeometry();
    const glyphPositionFloat32Array = new Float32Array(glyphPositionArray);
    const glyphBrightnessFloat32Array = new Float32Array(glyphBrightnessArray);
    const glyphUVFloat32Array = new Float32Array(glyphUVArray);

    const columns = Array(numColumns).fill().map((_, columnIndex) => {
      const column = {
        timeOffset: Math.random(),
        speedOffset: Math.random(),
        glyphs: Array(numRows).fill().map((_, index) => ({
          cycle: Math.random(),
          symbol: 0,
          brightness: 0,
        })),
        brightnessArray: glyphBrightnessFloat32Array.subarray(numRows * (columnIndex) * glyphBrightnessMarch * verticesPerGlyph, numRows * (columnIndex + 1) * glyphBrightnessMarch * verticesPerGlyph),
        uvArray: glyphUVFloat32Array.subarray(numRows * (columnIndex) * glyphUVMarch * verticesPerGlyph, numRows * (columnIndex + 1) * glyphUVMarch * verticesPerGlyph),
      };
      return column;
    });

    geometry.addAttribute('position', new THREE.BufferAttribute(glyphPositionFloat32Array, glyphPositionMarch));
    geometry.addAttribute('brightness', new THREE.BufferAttribute(glyphBrightnessFloat32Array, glyphBrightnessMarch));
    geometry.addAttribute('uv', new THREE.BufferAttribute(glyphUVFloat32Array, glyphUVMarch));
    geometry.setIndex(glyphIndexArray);

    const flattenedUVTemplate = [].concat(...glyphUVTemplate);
    const uvScrap = [];
    let last = NaN;

    const SQRT_2 = Math.sqrt(2);
    const SQRT_5 = Math.sqrt(5);

    const minimumPostProcessingFrameTime = 1;

    const brightnessChangeBias = animationSpeed == 0 ? 1 : Math.min(1, Math.abs(animationSpeed));

    const fract = x => x < 0 ? (1 - (-x % 1)) : (x % 1);

    const update = now => {
      if (now - last > 50) {
        last = now;
        return;
      }

      const delta = ((isNaN(last) || now - last > 1000) ? 0 : now - last) / 1000 * animationSpeed;
      last = now;

      bloomPass.enabled = delta < minimumPostProcessingFrameTime;
      filmGrainPass.enabled = delta < minimumPostProcessingFrameTime;

      composer.passes.filter(pass => !pass.enabled).renderToScreen = false;
      composer.passes.filter(pass => pass.enabled).pop().renderToScreen = true;

      const simTime = now * animationSpeed * fallSpeed * 0.0005;

      for (const column of columns) {

        const columnTime = (column.timeOffset * 1000 + simTime) * (0.5 + column.speedOffset * 0.5) + (Math.sin(simTime * 2 * column.speedOffset) * 0.2);

        for (let rowIndex = 0; rowIndex < column.glyphs.length; rowIndex++) {
          const glyph = column.glyphs[rowIndex];
          const glyphTime = rowIndex * 0.01 + columnTime;
          const value = 1 - fract((glyphTime + 0.3 * Math.sin(SQRT_2 * glyphTime) + 0.2 * Math.sin(SQRT_5 * glyphTime)));

          const computedBrightness = a + b * Math.log(c * (value - 0.5));
          const newBrightness = isNaN(computedBrightness) ? 0 : Math.min(1, Math.max(0, computedBrightness));
          glyph.brightness = glyph.brightness * (1 - brightnessChangeBias) + newBrightness * brightnessChangeBias;

          column.brightnessArray.set(glyphBrightnessTemplate.map(() => glyph.brightness), rowIndex * verticesPerGlyph * glyphBrightnessMarch);

          const glyphCycleSpeed = delta * cycleSpeed * 0.2 * Math.pow(1 - glyph.brightness, 4);
          glyph.cycle = fract(glyph.cycle + glyphCycleSpeed);
          const symbol = Math.floor(glyphSequenceLength * glyph.cycle);
          if (glyph.symbol != symbol) {
            glyph.symbol = symbol;
            const symbolX = (symbol % 8) / 8;
            const symbolY = (7 - (symbol - symbolX * 8) / 8) / 8;
            for (let i = 0; i < 4; i++) {
              uvScrap[i * 2 + 0] = flattenedUVTemplate[i * 2 + 0] + symbolX;
              uvScrap[i * 2 + 1] = flattenedUVTemplate[i * 2 + 1] + symbolY;
            }
            column.uvArray.set(uvScrap, rowIndex * verticesPerGlyph * glyphUVMarch);
          }
        }
      }
      geometry.attributes.uv.needsUpdate = true;
      geometry.attributes.brightness.needsUpdate = true;
    };

  return {geometry, update};
}
