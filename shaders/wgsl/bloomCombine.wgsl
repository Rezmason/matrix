// The blurred levels of the bloom pyramid get flattened (summed) into one full size bloom texture.

struct Config {
	bloomStrength : f32,
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var linearSampler : sampler;

@group(0) @binding(2) var pyr_0 : texture_2d<f32>;
@group(0) @binding(3) var pyr_1 : texture_2d<f32>;
@group(0) @binding(4) var pyr_2 : texture_2d<f32>;
@group(0) @binding(5) var pyr_3 : texture_2d<f32>;
@group(0) @binding(6) var pyr_4 : texture_2d<f32>;
@group(0) @binding(7) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

const TEXEL_CENTER : vec2<f32> = vec2<f32>(0.5, 0.5);

// Each level weighs a little less than the one above it: the cube roots of 0.9, 0.8, 0.7, 0.6 and 0.5
const LEVEL_WEIGHTS : array<f32, 5> = array<f32, 5>(0.96549, 0.92832, 0.88790, 0.84343, 0.79370);

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	var coord = vec2<u32>(input.id.xy);
	var outputSize = textureDimensions(outputTex);

	if (coord.x >= outputSize.x) {
		return;
	}

	var uv = (vec2<f32>(coord) + TEXEL_CENTER) / vec2<f32>(outputSize);

	var total = vec4<f32>(0.0);
	total += textureSampleLevel( pyr_0, linearSampler, uv, 0.0 ) * LEVEL_WEIGHTS[0];
	total += textureSampleLevel( pyr_1, linearSampler, uv, 0.0 ) * LEVEL_WEIGHTS[1];
	total += textureSampleLevel( pyr_2, linearSampler, uv, 0.0 ) * LEVEL_WEIGHTS[2];
	total += textureSampleLevel( pyr_3, linearSampler, uv, 0.0 ) * LEVEL_WEIGHTS[3];
	total += textureSampleLevel( pyr_4, linearSampler, uv, 0.0 ) * LEVEL_WEIGHTS[4];

	textureStore(outputTex, coord, total * config.bloomStrength);
}
