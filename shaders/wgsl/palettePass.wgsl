struct Config {
	bloomStrength : f32;
	ditherMagnitude : f32;
	backgroundColor : vec3<f32>;
};

struct Palette {
	colors : array<vec3<f32>, 512>;
};

struct Time {
	seconds : f32;
	frames : i32;
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var<uniform> palette : Palette;
@group(0) @binding(2) var<uniform> time : Time;
@group(0) @binding(3) var linearSampler : sampler;
@group(0) @binding(4) var tex : texture_2d<f32>;
@group(0) @binding(5) var bloomTex : texture_2d<f32>;
@group(0) @binding(6) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>;
};

let PI : f32 = 3.14159265359;

fn randomFloat( uv : vec2<f32> ) -> f32 {
	let a = 12.9898;
	let b = 78.233;
	let c = 43758.5453;
	let dt = dot( uv, vec2<f32>( a, b ) );
	let sn = dt % PI;
	return fract(sin(sn) * c);
}

fn getBrightness(uv : vec2<f32>) -> vec4<f32> {
	var primary = textureSampleLevel(tex, linearSampler, uv, 0.0);
	var bloom = textureSampleLevel(bloomTex, linearSampler, uv, 0.0) * config.bloomStrength;
	return min((primary + bloom) * (2.0 - config.bloomStrength), vec4<f32>(1.0));
}

@stage(compute) @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a texel coordinate
	var coord = vec2<i32>(input.id.xy);
	var screenSize = textureDimensions(tex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var uv = vec2<f32>(coord) / vec2<f32>(screenSize);

	var brightnessRGB = getBrightness(uv);

	// Combine the texture and bloom
	var brightness = brightnessRGB.r + brightnessRGB.g + brightnessRGB.b;

	// Dither: subtract a random value from the brightness
	brightness = brightness - randomFloat( uv + vec2<f32>(time.seconds) ) * config.ditherMagnitude;

	var paletteIndex = clamp(i32(brightness * 512.0), 0, 511);

	// Map the brightness to a position in the palette texture
	textureStore(outputTex, coord, vec4<f32>(palette.colors[paletteIndex] + config.backgroundColor, 1.0));
}

