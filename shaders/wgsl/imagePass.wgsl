struct Config {
	bloomStrength : f32,
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var linearSampler : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f32>;
@group(0) @binding(4) var backgroundTex : texture_2d<f32>;
@group(0) @binding(5) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

fn getBrightness(uv : vec2<f32>) -> vec4<f32> {
	var primary = textureSampleLevel(tex, linearSampler, uv, 0.0);
	var bloom = textureSampleLevel(bloomTex, linearSampler, uv, 0.0) * config.bloomStrength;
	return min((primary + bloom) * (2.0 - config.bloomStrength), vec4<f32>(1.0));
}

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a texel coordinate
	var coord = vec2<i32>(input.id.xy);
	var screenSize = textureDimensions(tex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var uv = vec2<f32>(coord) / vec2<f32>(screenSize);

	var bgColor = textureSampleLevel( backgroundTex, linearSampler, uv, 0.0 ).rgb;

	// Combine the texture and bloom, then blow it out to reveal more of the image
	var brightness = getBrightness(uv).r;
	brightness = pow(brightness, 1.5);

	textureStore(outputTex, coord, vec4<f32>(bgColor * brightness, 1.0));
}
