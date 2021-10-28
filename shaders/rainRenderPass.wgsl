let PI:f32 = 3.14159265359;
let TWO_PI:f32 = 6.28318530718;

[[block]] struct Uniforms {
	numColumns: i32;
	numRows: i32;
};
[[group(0), binding(0)]] var<uniform> uniforms:Uniforms;

[[block]] struct MSDFUniforms {
	numColumns: i32;
};
[[group(1), binding(0)]] var<uniform> msdfUniforms:MSDFUniforms;
[[group(1), binding(1)]] var msdfSampler: sampler;
[[group(1), binding(2)]] var msdfTexture: texture_2d<f32>;

[[block]] struct TimeUniforms {
	time: i32;
	frame: i32;
};
[[group(2), binding(0)]] var<uniform> timeUniforms:TimeUniforms;

// Vertex shader

struct VertexOutput {
	[[builtin(position)]] Position:vec4<f32>;
	[[location(0)]] UV:vec2<f32>;
};

[[stage(vertex)]] fn vertMain([[builtin(vertex_index)]] VertexIndex:u32) -> VertexOutput {

	var i = i32(VertexIndex);
	var quadIndex = i / 6;

	var cornerPosition = vec2<f32>(
		f32(i % 2),
		f32(((i + 1) % 6 / 3))
	);

	var x = uniforms.numColumns;

	var position = cornerPosition;
	position = position + vec2<f32>(
		f32(quadIndex % uniforms.numColumns),
		f32(quadIndex / uniforms.numColumns)
	);
	position = position / vec2<f32>(
		f32(uniforms.numColumns),
		f32(uniforms.numRows)
	);
	position = 1.0 - position * 2.0;
	// position.x = position.x + f32(quadIndex) * 0.01;

	return VertexOutput(
		vec4<f32>(position, 1.0, 1.0),
		cornerPosition
	);
}

// Fragment shader

[[stage(fragment)]] fn fragMain([[location(0)]] UV:vec2<f32>) -> [[location(0)]] vec4<f32> {
	var msdf:vec4<f32> = textureSample(msdfTexture, msdfSampler, UV / f32(msdfUniforms.numColumns));
	// msdf.b = msdf.b * (sin(f32(timeUniforms.time) / 1000.0 * TWO_PI) * 0.5 + 0.5);
	msdf.b = msdf.b * f32(timeUniforms.frame / 60 % 2);
	var time = timeUniforms.time;

	return msdf;
}
