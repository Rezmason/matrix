let NUM_VERTICES_PER_QUAD:i32 = 6;
let PI:f32 = 3.14159265359;
let TWO_PI:f32 = 6.28318530718;
let SQRT_2:f32 = 1.4142135623730951;
let SQRT_5:f32 = 2.23606797749979;

[[block]] struct Config {
	numColumns: i32;
	numRows: i32;
	glyphHeightToWidth: f32;
};
[[group(0), binding(0)]] var<uniform> config:Config;

[[block]] struct MSDF {
	glyphTextureColumns: i32;
	glyphSequenceLength: i32;
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

struct VertexOutput {
	[[builtin(position)]] Position:vec4<f32>;
	[[location(0)]] UV:vec2<f32>;
};

[[stage(vertex)]] fn vertMain([[builtin(vertex_index)]] VertexIndex:u32) -> VertexOutput {

	var i = i32(VertexIndex);
	var quadIndex = i / NUM_VERTICES_PER_QUAD;

	var cornerPosition = vec2<f32>(
		f32(i % 2),
		f32(((i + 1) % NUM_VERTICES_PER_QUAD / 3))
	);

	var cellPosition = vec2<i32>(
		quadIndex % config.numColumns,
		quadIndex / config.numColumns
	);

	var position = cornerPosition;
	position = position + vec2<f32>(cellPosition);
	position = position / vec2<f32>(
		f32(config.numColumns),
		f32(config.numRows)
	);
	position = 1.0 - position * 2.0;

	// position = position * scene.screenSize;

	var depth:f32 = 0.0;

	// depth = -0.5
	// 	+ sin(time.seconds * 2.0 + f32(cellPosition.x) / f32(config.numColumns) * 10.0) * 0.2
	// 	+ sin(time.seconds * 2.0 + f32(cellPosition.y) / f32(config.numColumns) * 10.0) * 0.2;

	var pos:vec4<f32> = vec4<f32>(position, depth, 1.0);
	pos.x = pos.x / config.glyphHeightToWidth;
	pos = scene.camera * scene.transform * pos;

	return VertexOutput(
		pos,
		cornerPosition
	);
}

// Fragment shader

[[stage(fragment)]] fn fragMain([[location(0)]] UV:vec2<f32>) -> [[location(0)]] vec4<f32> {
	var color:vec4<f32> = textureSample(msdfTexture, msdfSampler, UV / f32(msdf.glyphTextureColumns));
	// color.b = color.b * (sin(time.seconds * TWO_PI) * 0.5 + 0.5);
	color.b = color.b * f32(time.frames / 60 % 2);

	return color;
}
