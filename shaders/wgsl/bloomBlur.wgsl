// A three-tap blur, one texel wide, applied in one direction.
// Applying it to every level of the bloom pyramid approximates a much wider blur.

struct Config {
	direction : vec2<f32>,
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var linearSampler : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;
@group(0) @binding(3) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

const TEXEL_CENTER : vec2<f32> = vec2<f32>(0.5, 0.5);
const CENTER_WEIGHT : f32 = 0.442;
const NEIGHBOR_WEIGHT : f32 = 0.279;

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	var coord = vec2<u32>(input.id.xy);
	var outputSize = textureDimensions(outputTex);

	if (coord.x >= outputSize.x) {
		return;
	}

	var uv = (vec2<f32>(coord) + TEXEL_CENTER) / vec2<f32>(outputSize);
	var uvOffset = config.direction / vec2<f32>(outputSize);

	var sum = textureSampleLevel( tex, linearSampler, uv, 0.0 ) * CENTER_WEIGHT;
	sum += textureSampleLevel( tex, linearSampler, uv + uvOffset, 0.0 ) * NEIGHBOR_WEIGHT;
	sum += textureSampleLevel( tex, linearSampler, uv - uvOffset, 0.0 ) * NEIGHBOR_WEIGHT;

	textureStore(outputTex, coord, sum);
}
