struct Config {
	bloomStrength : f32;
	pyramidHeight : f32;
};

[[group(0), binding(0)]] var<uniform> config : Config;
[[group(0), binding(1)]] var linearSampler : sampler;

// Currently mipmap textures aren't working as expected in Firefox Nightly
// [[group(0), binding(2)]] var tex : texture_2d<f32>;
// [[group(0), binding(3)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

[[group(0), binding(2)]] var tex1 : texture_2d<f32>;
[[group(0), binding(3)]] var tex2 : texture_2d<f32>;
[[group(0), binding(4)]] var tex3 : texture_2d<f32>;
[[group(0), binding(5)]] var tex4 : texture_2d<f32>;
[[group(0), binding(6)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

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

	// for (var i = 0.0; i < config.pyramidHeight; i = i + 1.0) {
	// 	var weight = (1.0 - i / config.pyramidHeight);
	// 	weight = pow(weight + 0.5, 1.0 / 3.0);
	// 	sum = sum + textureSampleLevel( tex, linearSampler, uv, i + 1.0 ) * weight;
	// }

	{
		var i = 0.0;
		var weight = (1.0 - i / config.pyramidHeight);
		weight = pow(weight + 0.5, 1.0 / 3.0);
		sum = sum + textureSampleLevel( tex1, linearSampler, uv, i + 1.0 ) * weight;
	}
	{
		var i = 1.0;
		var weight = (1.0 - i / config.pyramidHeight);
		weight = pow(weight + 0.5, 1.0 / 3.0);
		sum = sum + textureSampleLevel( tex2, linearSampler, uv, i + 1.0 ) * weight;
	}
	{
		var i = 2.0;
		var weight = (1.0 - i / config.pyramidHeight);
		weight = pow(weight + 0.5, 1.0 / 3.0);
		sum = sum + textureSampleLevel( tex3, linearSampler, uv, i + 1.0 ) * weight;
	}
	{
		var i = 3.0;
		var weight = (1.0 - i / config.pyramidHeight);
		weight = pow(weight + 0.5, 1.0 / 3.0);
		sum = sum + textureSampleLevel( tex4, linearSampler, uv, i + 1.0 ) * weight;
	}

	textureStore(outputTex, coord, sum * config.bloomStrength);
}
