@group(0) @binding(0) var nearestSampler : sampler;
@group(0) @binding(1) var tex : texture_2d<f32>;

struct VertOutput {
	@builtin(position) Position : vec4<f32>,
	@location(0) uv : vec2<f32>,
};

@stage(vertex) fn vertMain(@builtin(vertex_index) index : u32) -> VertOutput {
	var uv = vec2<f32>(f32(index % 2u), f32((index + 1u) % 6u / 3u));
	var position = vec4<f32>(uv * 2.0 - 1.0, 1.0, 1.0);
	return VertOutput(position, uv);
}

@stage(fragment) fn fragMain(input : VertOutput) -> @location(0) vec4<f32> {
	var uv = input.uv;
	uv.y = 1.0 - uv.y;
	return textureSample( tex, nearestSampler, uv );
}
