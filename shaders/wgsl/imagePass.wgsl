[[group(0), binding(0)]] var linearSampler : sampler;
[[group(0), binding(1)]] var tex : texture_2d<f32>;
[[group(0), binding(2)]] var bloomTex : texture_2d<f32>;
[[group(0), binding(3)]] var backgroundTex : texture_2d<f32>;
[[group(0), binding(4)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	[[builtin(global_invocation_id)]] id : vec3<u32>;
};

[[stage(compute), workgroup_size(32, 1, 1)]] fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a texel coordinate
	var coord = vec2<i32>(input.id.xy);
	var screenSize = textureDimensions(tex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var uv = vec2<f32>(coord) / vec2<f32>(screenSize);

	var bgColor = textureSampleLevel( backgroundTex, linearSampler, uv, 0.0 ).rgb;

	// Combine the texture and bloom, then blow it out to reveal more of the image
	var brightness = min(1.0, textureSampleLevel( tex, linearSampler, uv, 0.0 ).r * 2.0);
	brightness = brightness + textureSampleLevel( bloomTex, linearSampler, uv, 0.0 ).r;
	brightness = pow(brightness, 1.5);

	textureStore(outputTex, coord, vec4<f32>(bgColor * brightness, 1.0));
}
