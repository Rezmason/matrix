// This shader module is the star of the show.
// It is where the cell states update and the symbols get drawn to the screen.

struct Config {
	// common properties used for compute and rendering
	animationSpeed : f32,
	glyphSequenceLength : f32,
	glyphTextureGridSize : vec2<i32>,
	glyphHeightToWidth : f32,
	gridSize : vec2<f32>,
	showDebugView : i32,

	// compute-specific properties
	brightnessThreshold : f32,
	brightnessOverride : f32,
	brightnessDecay : f32,
	cursorBrightness : f32,
	cycleSpeed : f32,
	cycleFrameSkip : i32,
	fallSpeed : f32,
	hasThunder : i32,
	raindropLength : f32,
	rippleScale : f32,
	rippleSpeed : f32,
	rippleThickness : f32,
	rippleType : i32,

	// render-specific properties
	msdfPxRange : f32,
	forwardSpeed : f32,
	baseBrightness : f32,
	baseContrast : f32,
	glintBrightness : f32,
	glintContrast : f32,
	hasBaseTexture: i32,
	hasGlintTexture: i32,
	glyphVerticalSpacing : f32,
	glyphEdgeCrop : f32,
	isPolar : i32,
	density : f32,
	slantScale : f32,
	slantVec : vec2<f32>,
	volumetric : i32,
	isolateCursor : i32,
	isolateGlint : i32,
	loops : i32,
	skipIntro : i32,
	highPassThreshold : f32,
};

// The properties that change over time get their own buffer.
struct Time {
	seconds : f32,
	frames : i32,
};

// The properties related to the size of the canvas get their own buffer.
struct Scene {
	screenSize : vec2<f32>,
	camera : mat4x4<f32>,
	transform : mat4x4<f32>,
};

struct Cell {
	raindrop : vec4<f32>,
	symbol : vec4<f32>,
	effect : vec4<f32>,
};

// The array of cells that the compute shader updates, and the fragment shader draws.
struct CellData {
	cells: array<Cell>,
};

struct IntroCell {
	progress : vec4<f32>,
};

// The array of cells that the compute shader updates, and the fragment shader draws.
struct IntroCellData {
	cells: array<IntroCell>,
};

// Shared bindings
@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var<uniform> time : Time;

// Intro-specific bindings
@group(0) @binding(2) var<storage, read_write> introCells_RW : IntroCellData;

// Compute-specific bindings
@group(0) @binding(2) var<storage, read_write> cells_RW : CellData;
@group(0) @binding(3) var<storage, read_write> introCells_RO : IntroCellData;

// Render-specific bindings
@group(0) @binding(2) var<uniform> scene : Scene;
@group(0) @binding(3) var linearSampler : sampler;
@group(0) @binding(4) var glyphMSDFTexture : texture_2d<f32>;
@group(0) @binding(5) var glintMSDFTexture : texture_2d<f32>;
@group(0) @binding(6) var baseTexture : texture_2d<f32>;
@group(0) @binding(7) var glintTexture : texture_2d<f32>;
@group(0) @binding(8) var<storage, read> cells_RO : CellData;

// Shader params

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

struct VertInput {
	@builtin(vertex_index) index : u32,
};

struct VertOutput {
	@builtin(position) Position : vec4<f32>,
	@location(0) uv : vec2<f32>,
	@location(1) quadDepth : f32,
};

struct FragOutput {
	@location(0) color : vec4<f32>,
	@location(1) highPassColor : vec4<f32>,
};

// Constants

const NUM_VERTICES_PER_QUAD : i32 = 6; // 2 * 3
const PI : f32 = 3.14159265359;
const TWO_PI : f32 = 6.28318530718;
const SQRT_2 : f32 = 1.4142135623730951;
const SQRT_5 : f32 = 2.23606797749979;

// Helper functions for generating randomness, borrowed from elsewhere

fn randomFloat( uv : vec2<f32> ) -> f32 {
	let a = 12.9898;
	let b = 78.233;
	let c = 43758.5453;
	let dt = dot( uv, vec2<f32>( a, b ) );
	let sn = dt % PI;
	return fract(sin(sn) * c);
}

fn randomVec2( uv : vec2<f32> ) -> vec2<f32> {
	return fract(vec2<f32>(sin(uv.x * 591.32 + uv.y * 154.077), cos(uv.x * 391.32 + uv.y * 49.077)));
}

fn wobble(x : f32) -> f32 {
	return x + 0.3 * sin(SQRT_2 * x) + 0.2 * sin(SQRT_5 * x);
}

// Compute shader core functions

// This is the code rain's key underlying concept.
// It's why glyphs that share a column are lit simultaneously, and are brighter toward the bottom.
// It's also why those bright areas are truncated into raindrops.
fn getRainBrightness(simTime : f32, glyphPos : vec2<f32>) -> f32 {
	var columnTimeOffset = randomFloat(vec2<f32>(glyphPos.x, 0.0)) * 1000.0;
	var columnSpeedOffset = randomFloat(vec2<f32>(glyphPos.x + 0.1, 0.0)) * 0.5 + 0.5;
	if (bool(config.loops)) {
		columnSpeedOffset = 0.5;
	}
	var columnTime = columnTimeOffset + simTime * config.fallSpeed * columnSpeedOffset;
	var rainTime = (glyphPos.y * 0.01 + columnTime) / config.raindropLength;
	if (!bool(config.loops)) {
		rainTime = wobble(rainTime);
	}
	return 1.0 - fract(rainTime);
}

// Compute shader additional effects

fn getThunder(simTime : f32, screenPos : vec2<f32>) -> f32 {
	if (!bool(config.hasThunder)) {
		return 0.0;
	}

	var thunderTime = simTime * 0.5;
	var thunder = 1.0 - fract(wobble(thunderTime));
	if (bool(config.loops)) {
		thunder = 1.0 - fract(thunderTime + 0.3);
	}

	thunder = log(thunder * 1.5) * 4.0;
	thunder = clamp(thunder, 0.0, 1.0) * 10.0 * pow(screenPos.y, 2.0);
	return thunder;
}

fn getRipple(simTime : f32, screenPos : vec2<f32>) -> f32 {
	if (config.rippleType == -1) {
		return 0.0;
	}

	var rippleTime = (simTime * 0.5 + sin(simTime) * 0.2) * config.rippleSpeed + 1.0; // TODO: clarify
	if (bool(config.loops)) {
		rippleTime = (simTime * 0.5) * config.rippleSpeed + 1.0;
	}

	var offset = randomVec2(vec2<f32>(floor(rippleTime), 0.0)) - 0.5;
	if (bool(config.loops)) {
		offset = vec2<f32>(0.0);
	}
	var ripplePos = screenPos * 2.0 - 1.0 + offset;
	var rippleDistance : f32;
	if (config.rippleType == 0) {
		var boxDistance = abs(ripplePos) * vec2<f32>(1.0, config.glyphHeightToWidth);
		rippleDistance = max(boxDistance.x, boxDistance.y);
	} else if (config.rippleType == 1) {
		rippleDistance = length(ripplePos);
	}

	var rippleValue = fract(rippleTime) * config.rippleScale - rippleDistance;

	if (rippleValue > 0.0 && rippleValue < config.rippleThickness) {
		return 0.75;
	}

	return 0.0;
}

// Compute shader main functions

fn computeIntroProgress (simTime : f32, isFirstFrame : bool, glyphPos : vec2<f32>, screenPos : vec2<f32>, previous : vec4<f32>) -> vec4<f32> {
	if (bool(config.skipIntro)) {
		return vec4<f32>(2.0, 0.0, 0.0, 0.0);
	}

	var columnTimeOffset = 0.0;
	var column = i32(glyphPos.x);
	if (column == i32(config.gridSize.y / 2.0)) {
		columnTimeOffset = -1.0;
	} else if (column == i32(config.gridSize.y * 0.75)) {
		columnTimeOffset = -2.0;
	} else {
		columnTimeOffset = randomFloat(vec2(glyphPos.x, 0.)) * -4.;
		columnTimeOffset += (sin(glyphPos.x / config.gridSize.y * PI) - 1.) * 2. - 2.5;
	}
	var introTime = (simTime + columnTimeOffset) * config.fallSpeed / config.gridSize.y * 100.0;

	var result = vec4<f32>(introTime, 0.0, 0.0, 0.0);
	return result;
}

fn computeRaindrop (simTime : f32, isFirstFrame : bool, glyphPos : vec2<f32>, screenPos : vec2<f32>, previous : vec4<f32>, progress : vec4<f32>) -> vec4<f32> {

	var brightness = getRainBrightness(simTime, glyphPos);
	var brightnessBelow = getRainBrightness(simTime, glyphPos + vec2(0.0, -1.0));

	var introProgress = progress.r - (1.0 - glyphPos.y / config.gridSize.y);
	var introProgressBelow = progress.r - (1.0 - (glyphPos.y - 1.0) / config.gridSize.y);

	var skipIntro = bool(config.skipIntro);
	var activated = bool(previous.b) || skipIntro || introProgress > 0.0;
	var activatedBelow = skipIntro || introProgressBelow > 0.0;

	var cursor = brightness > brightnessBelow || (activated && !activatedBelow);

	// Blend the glyph's brightness with its previous brightness, so it winks on and off organically
	if (!isFirstFrame) {
		var previousBrightness = previous.r;
		brightness = mix(previousBrightness, brightness, config.brightnessDecay);
	}

	var result = vec4<f32>(brightness, f32(cursor), f32(activated), introProgress);
	return result;
}

fn computeSymbol (simTime : f32, isFirstFrame : bool, glyphPos : vec2<f32>, screenPos : vec2<f32>, previous : vec4<f32>, raindrop : vec4<f32>) -> vec4<f32> {

	var previousSymbol = previous.r;
	var previousAge = previous.g;
	var resetGlyph = isFirstFrame;
	if (bool(config.loops)) {
		resetGlyph = resetGlyph || raindrop.r < 0.0;
	}
	if (resetGlyph) {
		previousAge = randomFloat(screenPos + 0.5);
		previousSymbol = floor(config.glyphSequenceLength * randomFloat(screenPos));
	}
	var cycleSpeed = config.animationSpeed * config.cycleSpeed;
	var age = previousAge;
	var symbol = previousSymbol;
	if (time.frames % config.cycleFrameSkip == 0) {
		age += cycleSpeed * f32(config.cycleFrameSkip);
		var advance = floor(age);
		if (age > 1.0) {
			symbol = floor(config.glyphSequenceLength * randomFloat(screenPos + simTime));
			age = fract(age);
		}
	}

	var result = vec4<f32>(symbol, age, 0.0, 0.0);
	return result;
}

fn computeEffect (simTime : f32, isFirstFrame : bool, glyphPos : vec2<f32>, screenPos : vec2<f32>, previous : vec4<f32>, raindrop : vec4<f32>) -> vec4<f32> {

	var multipliedEffects = 1.0 + getThunder(simTime, screenPos);
	var addedEffects = getRipple(simTime, screenPos); // Round or square ripples across the grid

	var result = vec4<f32>(multipliedEffects, addedEffects, 0.0, 0.0);
	return result;
}

@compute @workgroup_size(32, 1, 1) fn computeIntro(input : ComputeInput) {

	// Resolve the invocation ID to an intro cell coordinate
	var column = i32(input.id.x);

	if (column >= i32(config.gridSize.x)) {
		return;
	}

	var simTime = time.seconds * config.animationSpeed;
	var isFirstFrame = time.frames == 0;

	// Update the cell
	var glyphPos = vec2<f32>(f32(column), 0.0);
	var screenPos = glyphPos / config.gridSize;

	var introCell = introCells_RW.cells[column];
	introCell.progress = computeIntroProgress(simTime, isFirstFrame, glyphPos, screenPos, introCell.progress);
	introCells_RW.cells[column] = introCell;
}

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a cell coordinate
	var row = i32(input.id.y);
	var column = i32(input.id.x);

	if (column >= i32(config.gridSize.x)) {
		return;
	}

	var i = row * i32(config.gridSize.x) + column;

	var simTime = time.seconds * config.animationSpeed;
	var isFirstFrame = time.frames == 0;

	// Update the cell
	var glyphPos = vec2<f32>(f32(column), f32(row));
	var screenPos = glyphPos / config.gridSize;

	var cell = cells_RW.cells[i];
	var introCell = introCells_RO.cells[column];
	cell.raindrop = computeRaindrop(simTime, isFirstFrame, glyphPos, screenPos, cell.raindrop, introCell.progress);
	cell.symbol = computeSymbol(simTime, isFirstFrame, glyphPos, screenPos, cell.symbol, cell.raindrop);
	cell.effect = computeEffect(simTime, isFirstFrame, glyphPos, screenPos, cell.effect, cell.raindrop);
	cells_RW.cells[i] = cell;
}

// Vertex shader

// Firefox Nightly (that is to say, Naga) currently has a bug that mixes up these values from ones in the uniforms.
// var<private> quadCorners : array<vec2<f32>, NUM_VERTICES_PER_QUAD> = array<vec2<f32>, NUM_VERTICES_PER_QUAD>(
// 	vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
// 	vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0)
// );

@vertex fn vertMain(input : VertInput) -> VertOutput {

	var volumetric = bool(config.volumetric);

	var quadGridSize = select(vec2<f32>(1.0), config.gridSize, volumetric);

	// Convert the vertex index into its quad's position and its corner in its quad
	var i = i32(input.index);
	var quadIndex = i / NUM_VERTICES_PER_QUAD;

	// var quadCorner = quadCorners[i % NUM_VERTICES_PER_QUAD];
	var quadCorner = vec2<f32>(f32(i % 2), f32((i + 1) % 6 / 3));

	var quadPosition = vec2<f32>(
		f32(quadIndex % i32(quadGridSize.x)),
		f32(quadIndex / i32(quadGridSize.x))
	);

	// Calculate the vertex's uv
	var uv = (quadPosition + quadCorner) / quadGridSize;

	// Determine the quad's depth. This is a static value for each column of quads.
	var quadDepth = 0.0;
	if (volumetric) {
		var startDepth = randomFloat(vec2(quadPosition.x, 0.0));
		quadDepth = fract(startDepth + time.seconds * config.animationSpeed * config.forwardSpeed);
	}

	// Calculate the vertex's world space position
	var worldPosition = quadPosition * vec2<f32>(1.0, config.glyphVerticalSpacing);
	worldPosition += quadCorner * vec2<f32>(config.density, 1.0);
	if (volumetric) {
		worldPosition.y += randomFloat(vec2(quadPosition.x, 1.0));
	}
	worldPosition /= quadGridSize;
	worldPosition = (worldPosition - 0.5) * 2.0;

	// Convert the vertex's world space position to screen space
	var screenPosition = vec4<f32>(worldPosition, quadDepth, 1.0);
	if (volumetric) {
		screenPosition.x /= config.glyphHeightToWidth;
		screenPosition = scene.camera * scene.transform * screenPosition;
	} else {
		screenPosition = vec4<f32>(screenPosition.xy * scene.screenSize, screenPosition.zw);
	}

	return VertOutput(
		screenPosition,
		uv,
		quadDepth
	);
}

// Fragment shader core functions

fn median3(i : vec3<f32>) -> f32 {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

fn getUV(inputUV : vec2<f32>) -> vec2<f32> {

	var uv = inputUV;

	if (bool(config.volumetric)) {
		return uv;
	}

	if (bool(config.isPolar)) {
		// Curved space to make the letters appear to radiate from up above
		uv -= 0.5;
		uv *= 0.5;
		uv.y -= 0.5;
		var radius = length(uv);
		var angle = atan2(uv.y, uv.x) / (2.0 * PI) + 0.5;
		uv = vec2<f32>(fract(angle * 4.0 - 0.5), 1.5 * (1.0 - sqrt(radius)));
	} else {
		// Apply the slant and a scale to space so the viewport is still fully covered by the geometry
		uv = vec2<f32>(
			(uv.x - 0.5) * config.slantVec.x + (uv.y - 0.5) * config.slantVec.y,
			(uv.y - 0.5) * config.slantVec.x - (uv.x - 0.5) * config.slantVec.y
		) * config.slantScale + 0.5;
	}

	uv.y /= config.glyphHeightToWidth;

	return uv;
}

fn getBrightness(raindrop : vec4<f32>, effect : vec4<f32>, uv : vec2<f32>, quadDepth : f32) -> vec3<f32> {

	var base = raindrop.r + max(0.0, 1.0 - raindrop.a * 5.0);
	var isCursor = bool(raindrop.g) && bool(config.isolateCursor);
	var glint = base;
	var multipliedEffects = effect.r;
	var addedEffects = effect.g;

	var textureUV = fract(uv * config.gridSize);
	base = base * config.baseContrast + config.baseBrightness;
	if (bool(config.hasBaseTexture)) {
		base *= textureSample(baseTexture, linearSampler, textureUV).r;
	}
	glint = glint * config.glintContrast + config.glintBrightness;
	if (bool(config.hasGlintTexture)) {
		glint *= textureSample(glintTexture, linearSampler, textureUV).r;
	}

	// Modes that don't fade glyphs set their actual brightness here
	if (config.brightnessOverride > 0. && base > config.brightnessThreshold && !isCursor) {
		base = config.brightnessOverride;
	}

	base = base * multipliedEffects + addedEffects;
	glint = glint * multipliedEffects + addedEffects;

	// In volumetric mode, distant glyphs are dimmer
	if (bool(config.volumetric) && !bool(config.showDebugView)) {
		base = base * min(1.0, quadDepth);
		glint = glint * min(1.0, quadDepth);
	}

	return vec3<f32>(
		select(vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0), isCursor) * base,
		glint
	) * raindrop.b;
}

fn getSymbolUV(symbol : i32) -> vec2<f32> {
	var symbolX = symbol % config.glyphTextureGridSize.x;
	var symbolY = symbol / config.glyphTextureGridSize.x;
	return vec2<f32>(f32(symbolX), f32(symbolY));
}

fn getSymbol(cellUV : vec2<f32>, index : i32) -> vec2<f32> {
	// resolve UV to cropped position of glyph in MSDF texture
	var uv = fract(cellUV * config.gridSize);
	uv.y = 1.0 - uv.y; // y-flip
	uv -= 0.5;
	uv *= clamp(1.0 - config.glyphEdgeCrop, 0.0, 1.0);
	uv += 0.5;
	uv = (uv + getSymbolUV(index)) / vec2<f32>(config.glyphTextureGridSize);

	// MSDF: calculate brightness of fragment based on distance to shape
	var symbol = vec2<f32>();
	{
		// var dist = textureSample(glyphMSDFTexture, linearSampler, uv).rgb;
		// var sigDist = median3(dist) - 0.5;
		// symbol.r = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);

		var unitRange = vec2<f32>(config.msdfPxRange) / vec2<f32>(textureDimensions(glyphMSDFTexture));
		var screenTexSize = vec2<f32>(1.0) / fwidth(uv);
		var screenPxRange = max(0.5 * dot(unitRange, screenTexSize), 1.0);

		var signedDistance = median3(textureSample(glyphMSDFTexture, linearSampler, uv).rgb);
		var screenPxDistance = screenPxRange * (signedDistance - 0.5);
		symbol.r = clamp(screenPxDistance + 0.5, 0.0, 1.0);
	}

	if (bool(config.isolateGlint)) {
		// var dist = textureSample(glintMSDFTexture, linearSampler, uv).rgb;
		// var sigDist = median3(dist) - 0.5;
		// symbol.g =  clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);

		var unitRange = vec2<f32>(config.msdfPxRange) / vec2<f32>(textureDimensions(glintMSDFTexture));
		var screenTexSize = vec2<f32>(1.0) / fwidth(uv);
		var screenPxRange = max(0.5 * dot(unitRange, screenTexSize), 1.0);

		var signedDistance = median3(textureSample(glintMSDFTexture, linearSampler, uv).rgb);
		var screenPxDistance = screenPxRange * (signedDistance - 0.5);
		symbol.g = clamp(screenPxDistance + 0.5, 0.0, 1.0);
	}

	return symbol;
}

// Fragment shader

@fragment fn fragMain(input : VertOutput) -> FragOutput {

	var uv = getUV(input.uv);

	// Retrieve cell
	var gridCoord : vec2<i32> = vec2<i32>(uv * config.gridSize);
	var gridIndex = gridCoord.y * i32(config.gridSize.x) + gridCoord.x;
	var cell = cells_RO.cells[gridIndex];

	var brightness = getBrightness(
		cell.raindrop,
		cell.effect,
		uv,
		input.quadDepth
	);
	var symbol = getSymbol(uv, i32(cell.symbol.r));

	var output : FragOutput;

	if (bool(config.showDebugView)) {
		output.color = vec4<f32>(
			vec3<f32>(
				cell.raindrop.g,
				vec2<f32>(
					1.0 - ((1.0 - cell.raindrop.r) * 3.0),
					1.0 - ((1.0 - cell.raindrop.r) * 8.0)
				) * (1.0 - cell.raindrop.g)
			) * symbol.r,
			1.0
		);
	} else {
		output.color = vec4(brightness.rg * symbol.r, brightness.b * symbol.g, 0.0);
	}

	var highPassColor = output.color;
	if (highPassColor.r < config.highPassThreshold) {
		highPassColor.r = 0.0;
	}
	if (highPassColor.g < config.highPassThreshold) {
		highPassColor.g = 0.0;
	}
	if (highPassColor.b < config.highPassThreshold) {
		highPassColor.b = 0.0;
	}
	output.highPassColor = highPassColor;

	return output;
}
