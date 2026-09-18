// The high pass restricts the bloom to the bright parts of its input.
// It also downsamples: each level of the bloom pyramid is the high pass of the level above it.

struct Config {
	highPassThreshold : f32,
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var linearSampler : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;
@group(0) @binding(3) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

const TEXEL_CENTER : vec2<f32> = vec2<f32>(0.5, 0.5);

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	var coord = vec2<u32>(input.id.xy);
	var outputSize = textureDimensions(outputTex);

	if (coord.x >= outputSize.x) {
		return;
	}

	var uv = (vec2<f32>(coord) + TEXEL_CENTER) / vec2<f32>(outputSize);

	var color = textureSampleLevel( tex, linearSampler, uv, 0.0 );
	if (color.r < config.highPassThreshold) {
		color.r = 0.0;
	}
	if (color.g < config.highPassThreshold) {
		color.g = 0.0;
	}
	if (color.b < config.highPassThreshold) {
		color.b = 0.0;
	}

	textureStore(outputTex, coord, color);
}
