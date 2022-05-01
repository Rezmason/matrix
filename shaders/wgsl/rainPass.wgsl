// This shader module is the star of the show.
// It is where the cell states update and the symbols get drawn to the screen.

struct Config {
	// common properties used for compute and rendering
	animationSpeed : f32,
	glyphSequenceLength : i32,
	glyphTextureGridSize : vec2<i32>,
	glyphHeightToWidth : f32,
	resurrectingCodeRatio : f32,
	gridSize : vec2<f32>,
	showComputationTexture : i32,

	// compute-specific properties
	brightnessThreshold : f32,
	brightnessOverride : f32,
	brightnessDecay : f32,
	cursorEffectThreshold : f32,
	cycleSpeed : f32,
	cycleFrameSkip : i32,
	fallSpeed : f32,
	hasSun : i32,
	hasThunder : i32,
	raindropLength : f32,
	rippleScale : f32,
	rippleSpeed : f32,
	rippleThickness : f32,
	cycleStyle : i32,
	rippleType : i32,

	// render-specific properties
	forwardSpeed : f32,
	glyphVerticalSpacing : f32,
	glyphEdgeCrop : f32,
	isPolar : i32,
	density : f32,
	slantScale : f32,
	slantVec : vec2<f32>,
	volumetric : i32,
	loops : i32,
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

// The array of cells that the compute shader updates, and the fragment shader draws.
struct CellData {
	cells: array<vec4<f32>>,
};

// Shared bindings
@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var<uniform> time : Time;

// Compute-specific bindings
@group(0) @binding(2) var<storage, read_write> cells_RW : CellData;

// Render-specific bindings
@group(0) @binding(2) var<uniform> scene : Scene;
@group(0) @binding(3) var linearSampler : sampler;
@group(0) @binding(4) var msdfTexture : texture_2d<f32>;
@group(0) @binding(5) var<storage, read> cells_RO : CellData;

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
	@location(1) channel : vec3<f32>,
	@location(2) glyph : vec4<f32>,
};

struct FragOutput {
	@location(0) color : vec4<f32>,
	@location(1) highPassColor : vec4<f32>,
};

// Constants

let NUM_VERTICES_PER_QUAD : i32 = 6; // 2 * 3
let PI : f32 = 3.14159265359;
let TWO_PI : f32 = 6.28318530718;
let SQRT_2 : f32 = 1.4142135623730951;
let SQRT_5 : f32 = 2.23606797749979;

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

// Rain time is the shader's key underlying concept.
// It's why glyphs that share a column are lit simultaneously, and are brighter toward the bottom.
fn getRainTime(simTime : f32, glyphPos : vec2<f32>) -> f32 {
	var columnTimeOffset = randomFloat(vec2<f32>(glyphPos.x, 0.0)) * 1000.0;
	var columnSpeedOffset = randomFloat(vec2<f32>(glyphPos.x + 0.1, 0.0)) * 0.5 + 0.5;
	if (bool(config.loops)) {
		columnSpeedOffset = 0.5;
	}
	var columnTime = columnTimeOffset + simTime * config.fallSpeed * columnSpeedOffset;
	return (glyphPos.y * 0.01 + columnTime) / config.raindropLength;
}

fn getBrightness(rainTime : f32) -> f32 {
	var value = 1.0 - fract(wobble(rainTime));
	if (bool(config.loops)) {
		value = 1.0 - fract(rainTime);
	}
	return log(value * 1.25) * 3.0;
}

fn getCycleSpeed(rainTime : f32, brightness : f32) -> f32 {
	var localCycleSpeed = 0.0;
	if (config.cycleStyle == 0 && brightness > 0.0) {
		localCycleSpeed = pow(1.0 - brightness, 4.0);
	} else if (config.cycleStyle == 1) {
		localCycleSpeed = fract(rainTime);
	}
	return config.animationSpeed * config.cycleSpeed * localCycleSpeed;
}

// Compute shader additional effects

fn applySunShowerBrightness(brightness : f32, screenPos : vec2<f32>) -> f32 {
	if (brightness >= -4.0) {
		return pow(fract(brightness * 0.5), 3.0) * screenPos.y * 1.5;
	}
	return brightness;
}

fn applyThunderBrightness(brightness : f32, simTime : f32, screenPos : vec2<f32>) -> f32 {
	var thunderTime = simTime * 0.5;
	var thunder = 1.0 - fract(wobble(thunderTime));
	if (bool(config.loops)) {
		thunder = 1.0 - fract(thunderTime + 0.3);
	}

	thunder = log(thunder * 1.5) * 4.0;
	thunder = clamp(thunder, 0.0, 1.0);
	thunder *= pow(screenPos.y, 2.0) * 3.0;
	return brightness + thunder;
}

fn applyRippleEffect(effect : f32, simTime : f32, screenPos : vec2<f32>) -> f32 {
	if (config.rippleType == -1) {
		return effect;
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
		return effect + 0.75;
	}

	return effect;
}

fn applyCursorEffect(effect : f32, brightness : f32) -> f32 {
	if (brightness >= config.cursorEffectThreshold) {
		return 1.0;
	}
	return effect;
}

// Compute shader main functions

fn computeResult (isFirstFrame : bool, previousResult : vec4<f32>, glyphPos : vec2<f32>, screenPos : vec2<f32>) -> vec4<f32> {

	// Determine the glyph's local time.
	var simTime = time.seconds * config.animationSpeed;
	var rainTime = getRainTime(simTime, glyphPos);

	// Rain time is the backbone of this effect.

	// Determine the glyph's brightness.
	var previousBrightness = previousResult.r;
	var brightness = getBrightness(rainTime);
	if (bool(config.hasSun)) {
		brightness = applySunShowerBrightness(brightness, screenPos);
	}
	if (bool(config.hasThunder)) {
		brightness = applyThunderBrightness(brightness, simTime, screenPos);
	}

	// Determine the glyph's cycle— the percent this glyph has progressed through the glyph sequence
	var previousCycle = previousResult.g;
	var resetGlyph = isFirstFrame;
	if (bool(config.loops)) {
		resetGlyph = resetGlyph || previousBrightness < 0.0;
	}
	if (resetGlyph) {
		previousCycle = select(randomFloat(screenPos), 0.0, bool(config.showComputationTexture));
	}
	var localCycleSpeed = getCycleSpeed(rainTime, brightness);
	var cycle = previousCycle;
	if (time.frames % config.cycleFrameSkip == 0) {
		cycle = fract(previousCycle + 0.005 * localCycleSpeed * f32(config.cycleFrameSkip));
	}

	// Determine the glyph's effect— the amount the glyph lights up for other reasons
	var effect = 0.0;
	effect = applyRippleEffect(effect, simTime, screenPos); // Round or square ripples across the grid
	effect = applyCursorEffect(effect, brightness); // The bright glyphs at the "bottom" of raindrops

	// Modes that don't fade glyphs set their actual brightness here
	if (config.brightnessOverride > 0.0 && brightness > config.brightnessThreshold) {
		brightness = config.brightnessOverride;
	}

	// Blend the glyph's brightness with its previous brightness, so it winks on and off organically
	if (!isFirstFrame) {
		brightness = mix(previousBrightness, brightness, config.brightnessDecay);
	}

	// Determine the glyph depth. This is a static value for each column.
	var depth = randomFloat(vec2<f32>(screenPos.x, 0.0));

	var result = vec4<f32>(brightness, cycle, depth, effect);

	// Better use of the alpha channel, for demonstrating how the glyph cycle works
	if (bool(config.showComputationTexture)) {
		result.a = min(1.0, localCycleSpeed);
	}

	return result;
}

@stage(compute) @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a cell coordinate
	var row = i32(input.id.y);
	var column = i32(input.id.x);

	if (column >= i32(config.gridSize.x)) {
		return;
	}

	var i = row * i32(config.gridSize.x) + column;

	// Update the cell
	var isFirstFrame = time.frames == 0;
	var glyphPos = vec2<f32>(f32(column), f32(row));
	var screenPos = glyphPos / config.gridSize;
	var previousResult = cells_RW.cells[i];
	cells_RW.cells[i] = computeResult(isFirstFrame, previousResult, glyphPos, screenPos);
}

// Vertex shader

// Firefox Nightly (that is to say, Naga) currently has a bug that mixes up these values from ones in the uniforms.
// var<private> quadCorners : array<vec2<f32>, NUM_VERTICES_PER_QUAD> = array<vec2<f32>, NUM_VERTICES_PER_QUAD>(
// 	vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
// 	vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0)
// );

@stage(vertex) fn vertMain(input : VertInput) -> VertOutput {

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

	// Retrieve the quad's glyph data
	var glyph = cells_RO.cells[quadIndex];

	// Calculate the quad's depth
	var quadDepth = 0.0;
	if (volumetric) {
		quadDepth = fract(glyph.b + time.seconds * config.animationSpeed * config.forwardSpeed);
		glyph.b = quadDepth;
	}

	// Calculate the vertex's world space position
	var worldPosition = quadPosition * vec2<f32>(1.0, config.glyphVerticalSpacing);
	worldPosition += quadCorner * vec2<f32>(config.density, 1.0);
	worldPosition /= quadGridSize;
	worldPosition = (worldPosition - 0.5) * 2.0;

	// "Resurrected" columns are in the green channel,
	// and are vertically flipped (along with their glyphs)
	var channel = vec3<f32>(1.0, 0.0, 0.0);
	if (volumetric && randomFloat(vec2<f32>(quadPosition.x, 0.0)) < config.resurrectingCodeRatio) {
		worldPosition.y = -worldPosition.y;
		channel = vec3<f32>(0.0, 1.0, 0.0);
	}

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
		channel,
		glyph
	);
}

// Fragment shader core functions

fn median3(i : vec3<f32>) -> f32 {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

fn getSymbolUV(glyphCycle : f32) -> vec2<f32> {
	var symbol = i32(f32(config.glyphSequenceLength) * glyphCycle);
	var symbolX = symbol % config.glyphTextureGridSize.x;
	var symbolY = symbol / config.glyphTextureGridSize.x;
	// TODO: make sure this is working properly, it had a bug in the GLSL for a while.
	return vec2<f32>(f32(symbolX), f32(symbolY));
}

// Fragment shader

@stage(fragment) fn fragMain(input : VertOutput) -> FragOutput {

	var volumetric = bool(config.volumetric);
	var uv = input.uv;

	// For normal mode, derive the fragment's glyph and msdf UV from its screen space position
	if (!volumetric) {
		if (bool(config.isPolar)) {
			// Curve space to make the letters appear to radiate from up above
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
	}

	// Retrieve values from the data texture
	var glyph : vec4<f32>;
	if (volumetric) {
		glyph = input.glyph;
	} else {
		var gridCoord : vec2<i32> = vec2<i32>(uv * config.gridSize);
		var gridIndex = gridCoord.y * i32(config.gridSize.x) + gridCoord.x;
		glyph = cells_RO.cells[gridIndex];
	}
	var brightness = glyph.r;
	var symbolUV = getSymbolUV(glyph.g);
	var quadDepth = glyph.b;
	var effect = glyph.a;

	brightness = max(effect, brightness);
	// In volumetric mode, distant glyphs are dimmer
	if (volumetric) {
		brightness *= min(1.0, quadDepth);
	}

	// resolve UV to cropped position of glyph in MSDF texture
	var glyphUV = fract(uv * config.gridSize);
	glyphUV.y = 1.0 - glyphUV.y; // WebGL -> WebGPU y-flip
	glyphUV -= 0.5;
	glyphUV *= clamp(1.0 - config.glyphEdgeCrop, 0.0, 1.0);
	glyphUV += 0.5;
	var msdfUV = (glyphUV + symbolUV) / vec2<f32>(config.glyphTextureGridSize);

	// MSDF : calculate brightness of fragment based on distance to shape
	var dist = textureSample(msdfTexture, linearSampler, msdfUV).rgb;
	var sigDist = median3(dist) - 0.5;
	var alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);

	var output : FragOutput;

	if (bool(config.showComputationTexture)) {
		output.color = vec4<f32>(glyph.r - alpha, glyph.g * alpha, glyph.a - alpha, 1.0);
		if (volumetric) {
			output.color.g *= 0.9 + 0.1;
		}
	} else {
		output.color = vec4<f32>(input.channel * brightness * alpha, 1.0);
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
