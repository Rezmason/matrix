struct Config {
	unused : f32,
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
	var bloom = textureSampleLevel(bloomTex, linearSampler, uv, 0.0);
	return primary + bloom;
}

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	var unused = config.unused;

	// Resolve the invocation ID to a texel coordinate
	var coord = vec2<u32>(input.id.xy);
	var screenSize = textureDimensions(tex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var uv = vec2<f32>(coord) / vec2<f32>(screenSize);

	var bgColor = textureSampleLevel( backgroundTex, linearSampler, vec2<f32>(uv.x, 1.0 - uv.y), 0.0 ).rgb;

	// Combine the texture and bloom, then blow it out to reveal more of the image
	var brightness = getBrightness(uv);

	textureStore(outputTex, coord, vec4<f32>(bgColor * (brightness.r + brightness.g * 2.0), 1.0));
}
