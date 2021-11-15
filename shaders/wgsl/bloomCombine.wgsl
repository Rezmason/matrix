[[block]] struct Config {
	bloomStrength : f32;
	pyramidHeight : f32;
};

[[group(0), binding(0)]] var<uniform> config : Config;
[[group(0), binding(1)]] var linearSampler : sampler;
[[group(0), binding(2)]] var tex : texture_2d<f32>;
[[group(0), binding(3)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	[[builtin(global_invocation_id)]] id : vec3<u32>;
};

[[stage(compute), workgroup_size(32, 1, 1)]] fn computeMain(input : ComputeInput) {

	var coord = vec2<i32>(input.id.xy);
	var outputSize = textureDimensions(outputTex);

	if (coord.x >= outputSize.x) {
		return;
	}

	var uv = (vec2<f32>(coord) + 0.5) / vec2<f32>(outputSize);
	var sum = vec4<f32>(0.0);
	for (var i = 0.0; i < config.pyramidHeight; i = i + 1.0) {
		sum = sum + (1.0 - i / config.pyramidHeight) * textureSampleLevel( tex, linearSampler, uv, i + 1.0 );
	}

	textureStore(outputTex, coord, sum * config.bloomStrength);
}
