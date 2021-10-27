[[block]] struct Uniforms {
	numColumns: i32;
	numRows: i32;
};
[[binding(0), group(0)]] var<uniform> uniforms : Uniforms;

struct VertexOutput {
	[[builtin(position)]] Position : vec4<f32>;
	[[location(0)]] UV : vec2<f32>;
};

[[stage(vertex)]] fn main([[builtin(vertex_index)]] VertexIndex : u32) -> VertexOutput {

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
	position = position * 2.0 - 1.0;

	return VertexOutput(
		vec4<f32>(position, 1.0, 1.0),
		cornerPosition
	);
}
