[[block]] struct Time {
	seconds : f32;
	frames : i32;
};

[[group(0), binding(0)]] var textureSampler : sampler;
[[group(0), binding(1)]] var inputTex : texture_2d<f32>;
[[group(0), binding(2)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

// Compute shader

[[stage(compute), workgroup_size(32, 1, 1)]] fn computeMain([[builtin(global_invocation_id)]] id : vec3<u32>) {
	var row = i32(id.y);
	var column = i32(id.x);

	if (column >= i32(textureDimensions(inputTex).x)) {
		return;
	}

	var color = textureSampleLevel(inputTex, textureSampler, vec2<f32>(f32(column), f32(row)), 0.0);
	color.g = color.r;
	textureStore(outputTex, vec2<i32>(column, row), color);
}
