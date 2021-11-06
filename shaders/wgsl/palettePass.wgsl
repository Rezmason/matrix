[[block]] struct Config {
	ditherMagnitude : f32;
	backgroundColor : vec3<f32>;
};

[[block]] struct Palette {
	colors : array<vec3<f32>, 512>;
};

[[block]] struct Time {
	seconds : f32;
	frames : i32;
};

[[group(0), binding(0)]] var<uniform> config : Config;
[[group(0), binding(1)]] var<uniform> palette : Palette;
[[group(0), binding(2)]] var<uniform> time : Time;
[[group(0), binding(3)]] var linearSampler : sampler;
[[group(0), binding(4)]] var tex : texture_2d<f32>;
[[group(0), binding(5)]] var bloomTex : texture_2d<f32>;

struct VertOutput {
	[[builtin(position)]] Position : vec4<f32>;
	[[location(0)]] uv : vec2<f32>;
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

[[stage(vertex)]] fn vertMain([[builtin(vertex_index)]] index : u32) -> VertOutput {
	var uv = vec2<f32>(f32(index % 2u), f32((index + 1u) % 6u / 3u));
	var position = vec4<f32>(uv * 2.0 - 1.0, 1.0, 1.0);
	return VertOutput(position, uv);
}

[[stage(fragment)]] fn fragMain(input : VertOutput) -> [[location(0)]] vec4<f32> {

	var uv = input.uv;
	uv.y = 1.0 - uv.y;

	var brightnessRGB = textureSample( tex, linearSampler, uv ) + textureSample( bloomTex, linearSampler, uv );

	// Combine the texture and bloom
	var brightness = brightnessRGB.r + brightnessRGB.g + brightnessRGB.b;

	// Dither: subtract a random value from the brightness
	brightness = brightness - randomFloat( uv + vec2<f32>(time.seconds) ) * config.ditherMagnitude;

	var paletteIndex = clamp(i32(brightness * 512.0), 0, 511);

	// Map the brightness to a position in the palette texture
	return vec4<f32>(palette.colors[paletteIndex] + config.backgroundColor, 1.0);
}
