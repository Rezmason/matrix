let ONE_OVER_SQRT_2PI = 0.39894;

struct Config {
	bloomRadius : f32;
	direction : vec2<f32>;
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var linearSampler : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;
@group(0) @binding(3) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>;
};

fn gaussianPDF(x : f32) -> f32 {
	return ONE_OVER_SQRT_2PI * exp( -0.5 *
		( x * x ) / ( config.bloomRadius * config.bloomRadius )
	) / config.bloomRadius;
}

@stage(compute) @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	var coord = vec2<i32>(input.id.xy);
	var outputSize = textureDimensions(outputTex);

	if (coord.x >= outputSize.x) {
		return;
	}

	var uv = (vec2<f32>(coord) + 0.5) / vec2<f32>(outputSize);
	var uvOffset = config.direction / vec2<f32>(outputSize);

	var weightSum = gaussianPDF(0.0);
	var sum = textureSampleLevel( tex, linearSampler, uv, 0.0) * weightSum;
	for (var x : f32 = 1.0; x < config.bloomRadius; x = x + 1.0) {
		var weight = gaussianPDF(x);
		sum = sum + textureSampleLevel( tex, linearSampler, uv + uvOffset * x, 0.0) * weight;
		sum = sum + textureSampleLevel( tex, linearSampler, uv - uvOffset * x, 0.0) * weight;
		weightSum = weightSum + weight * 2.0;
	}

	textureStore(outputTex, coord, sum / weightSum);
}
