let NUM_VERTICES_PER_QUAD:i32 = 6; // 2 * 3
let PI:f32 = 3.14159265359;
let TWO_PI:f32 = 6.28318530718;
let SQRT_2:f32 = 1.4142135623730951;
let SQRT_5:f32 = 2.23606797749979;

// Bound resources

[[block]] struct Config {
	// common
	animationSpeed : f32;
	glyphHeightToWidth : f32;
	resurrectingCodeRatio : f32;
	gridSize : vec2<f32>;
	showComputationTexture : i32;

	// compute
	brightnessThreshold : f32;
	brightnessOverride : f32;
	brightnessDecay : f32;
	cursorEffectThreshold : f32;
	cycleSpeed : f32;
	cycleFrameSkip : i32;
	fallSpeed : f32;
	hasSun : i32;
	hasThunder : i32;
	raindropLength : f32;
	rippleScale : f32;
	rippleSpeed : f32;
	rippleThickness : f32;
	cycleStyle : i32;
	rippleType : i32;

	// render
	forwardSpeed : f32;
	glyphVerticalSpacing : f32;
	glyphEdgeCrop : f32;
	isPolar : i32;
	density : f32;
	slantScale : f32;
	slantVec : vec2<f32>;
	volumetric : i32;
};
[[group(0), binding(0)]] var<uniform> config:Config;

[[block]] struct MSDF {
	glyphSequenceLength: i32;
	glyphTextureColumns: i32;
};
[[group(0), binding(1)]] var<uniform> msdf:MSDF;
[[group(0), binding(2)]] var msdfSampler: sampler;
[[group(0), binding(3)]] var msdfTexture: texture_2d<f32>;

[[block]] struct Time {
	seconds:f32;
	frames:i32;
};
[[group(0), binding(4)]] var<uniform> time:Time;

[[block]] struct Scene {
	screenSize: vec2<f32>;
	camera: mat4x4<f32>;
	transform: mat4x4<f32>;
};
[[group(0), binding(5)]] var<uniform> scene:Scene;

// Shader params

struct VertInput {
	[[builtin(vertex_index)]] index:u32;
};

struct VertOutput {
	[[builtin(position)]] Position:vec4<f32>;
	[[location(0)]] uv:vec2<f32>;
	[[location(1)]] channel:vec3<f32>;
	[[location(2)]] glyph:vec4<f32>;
};

struct FragOutput {
	[[location(0)]] color:vec4<f32>;
};

// Helper functions for generating randomness, borrowed from elsewhere

fn randomFloat( uv:vec2<f32> ) -> f32 {
	let a = 12.9898;
	let b = 78.233;
	let c = 43758.5453;
	let dt = dot( uv, vec2<f32>( a,b ) );
	let sn = dt % PI;
	return fract(sin(sn) * c);
}

fn randomVec2( uv:vec2<f32> ) -> vec2<f32> {
	return fract(vec2<f32>(sin(uv.x * 591.32 + uv.y * 154.077), cos(uv.x * 391.32 + uv.y * 49.077)));
}

fn wobble(x:f32) -> f32 {
	return x + 0.3 * sin(SQRT_2 * x) + 0.2 * sin(SQRT_5 * x);
}

// Vertex shader

[[stage(vertex)]] fn vertMain(input: VertInput) -> VertOutput {

	var volumetric = bool(config.volumetric);

	var quadGridSize = vec2<f32>(1.0);
	if (volumetric) {
		quadGridSize = config.gridSize;
	}

	// Convert the vertex index into its quad's position and its corner in its quad
	var i = i32(input.index);
	var quadIndex = i / NUM_VERTICES_PER_QUAD;

	var quadCorner = vec2<f32>(
		f32(i % 2),
		f32((i + 1) % NUM_VERTICES_PER_QUAD / 3)
	);

	var quadPosition = vec2<f32>(
		f32(quadIndex % i32(quadGridSize.x)),
		f32(quadIndex / i32(quadGridSize.x))
	);

	// Calculate the vertex's uv
	var uv = (quadPosition + quadCorner) / quadGridSize;

	// Retrieve the quad's glyph data
	var vGlyph = vec4<f32>(1.0, 0.72, randomFloat(vec2<f32>(quadPosition.x, 1.0)), 0.0); // TODO: texture2D(state, quadPosition / quadGridSize);

	// Calculate the quad's depth
	var quadDepth = 0.0;
	if (volumetric && !bool(config.showComputationTexture)) {
		quadDepth = fract(vGlyph.b + time.seconds * config.animationSpeed * config.forwardSpeed);
		vGlyph.b = quadDepth;
	}

	// Calculate the vertex's world space position
	var worldPosition = quadPosition * vec2<f32>(1.0, config.glyphVerticalSpacing);
	worldPosition = worldPosition + quadCorner * vec2<f32>(config.density, 1.0);
	worldPosition = worldPosition / quadGridSize;
	worldPosition = (worldPosition - 0.5) * 2.0;
	worldPosition.y = -worldPosition.y;

	// "Resurrected" columns are in the green channel,
	// and are vertically flipped (along with their glyphs)
	var vChannel = vec3<f32>(1.0, 0.0, 0.0);
	if (volumetric && randomFloat(vec2<f32>(quadPosition.x, 0.0)) < config.resurrectingCodeRatio) {
		worldPosition.y = -worldPosition.y;
		vChannel = vec3<f32>(0.0, 1.0, 0.0);
	}

	vChannel = vec3<f32>(1.0); // TODO: remove

	// Convert the vertex's world space position to screen space
	var screenPosition = vec4<f32>(worldPosition, quadDepth, 1.0);
	if (volumetric) {
		screenPosition.x = screenPosition.x / config.glyphHeightToWidth;
		screenPosition = scene.camera * scene.transform * screenPosition;
	} else {
		screenPosition = vec4<f32>(screenPosition.xy * scene.screenSize, screenPosition.zw);
	}

	return VertOutput(
		screenPosition,
		uv,
		vChannel,
		vGlyph
	);
}

// Fragment shader

fn median3(i:vec3<f32>) -> f32 {
	return max(min(i.r, i.g), min(max(i.r, i.g), i.b));
}

fn getSymbolUV(glyphCycle:f32) -> vec2<f32> {
	var symbol = i32(f32(msdf.glyphSequenceLength) * glyphCycle);
	var symbolX = symbol % msdf.glyphTextureColumns;
	var symbolY = ((msdf.glyphTextureColumns - 1) - (symbol - symbolX) / msdf.glyphTextureColumns);
	return vec2<f32>(f32(symbolX), f32(symbolY));
}

[[stage(fragment)]] fn fragMain(input: VertOutput) -> FragOutput {

	var volumetric = bool(config.volumetric);
	var uv = input.uv;

	// For normal mode, derive the fragment's glyph and msdf UV from its screen space position
	if (!volumetric) {
		if (bool(config.isPolar)) {
			// Curve space to make the letters appear to radiate from up above
			uv = (uv - 0.5) * 0.5;
			uv.y = uv.y + 0.5;
			var radius = length(uv);
			var angle = atan2(uv.y, uv.x) / (2.0 * PI) + 0.5;
			uv = -vec2<f32>(fract(angle * 4.0 - 0.5), 1.5 * (1.0 - sqrt(radius)));
		} else {
			// Apply the slant and a scale to space so the viewport is still fully covered by the geometry
			uv = vec2<f32>(
				(uv.x - 0.5) * config.slantVec.x + (uv.y - 0.5) * -config.slantVec.y,
				(uv.y - 0.5) * config.slantVec.x - (uv.x - 0.5) * -config.slantVec.y
			) * config.slantScale + 0.5;
		}
		uv.y = uv.y / config.glyphHeightToWidth;
	}

	// Retrieve values from the data texture
	var glyph:vec4<f32>;
	if (volumetric) {
		glyph = input.glyph;
	} else {
		glyph = vec4<f32>(1.0); // TODO: texture2D(state, uv);
	}
	glyph = input.glyph; // TODO: remove
	var brightness = glyph.r;
	var symbolUV = getSymbolUV(glyph.g);
	var quadDepth = glyph.b;
	var effect = glyph.a;

	brightness = max(effect, brightness);
	// In volumetric mode, distant glyphs are dimmer
	if (volumetric) {
		brightness = brightness * min(1.0, quadDepth);
	}

	// resolve UV to cropped position of glyph in MSDF texture
	var glyphUV = fract(uv * config.gridSize);
	glyphUV = glyphUV - 0.5;
	glyphUV = glyphUV * clamp(1.0 - config.glyphEdgeCrop, 0.0, 1.0);
	glyphUV = glyphUV + 0.5;
	var msdfUV = (glyphUV + symbolUV) / f32(msdf.glyphTextureColumns);

	// MSDF: calculate brightness of fragment based on distance to shape
	var dist = textureSample(msdfTexture, msdfSampler, msdfUV).rgb;
	var sigDist = median3(dist) - 0.5;
	var alpha = clamp(sigDist / fwidth(sigDist) + 0.5, 0.0, 1.0);

	var output:FragOutput;

	if (bool(config.showComputationTexture)) {
		output.color = vec4<f32>(glyph.rgb * alpha, 1.0);
	} else {
		output.color = vec4<f32>(input.channel * brightness * alpha, 1.0);
	}

	return output;
}
