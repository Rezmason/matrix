[[block]] struct Config {
	ditherMagnitude : f32;
	backgroundColor : vec3<f32>;
};

[[block]] struct Time {
	seconds : f32;
	frames : i32;
};

[[group(0), binding(0)]] var<uniform> config : Config;
[[group(0), binding(1)]] var<uniform> time : Time;
[[group(0), binding(2)]] var linearSampler : sampler;
[[group(0), binding(3)]] var tex : texture_2d<f32>;
[[group(0), binding(4)]] var bloomTex : texture_2d<f32>;

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

fn rgbComponent(p : f32, q : f32, t : f32) -> f32 {
	var t2 = t;
	if (t2 < 0.0) { t2 = t2 + 1.0; }
	if (t2 > 1.0) { t2 = t2 - 1.0; }
	if (t2 < 1.0 / 6.0) { return p + (q - p) * 6.0 * t2; }
	if (t2 < 1.0 / 2.0) { return q; }
	if (t2 < 2.0 / 3.0) { return p + (q - p) * (2.0 / 3.0 - t2) * 6.0; }
	return p;
}

fn hslToRgb(h : f32, s : f32, l : f32) -> vec3<f32> {
	var q : f32;
	if (l < 0.5) {
		q = l * (1. + s);
	} else {
		q = l + s - l * s;
	}
	var p = 2.0 * l - q;
	return vec3<f32>(
		rgbComponent(p, q, h + 1.0 / 3.0),
		rgbComponent(p, q, h),
		rgbComponent(p, q, h - 1.0 / 3.0)
	);
}

[[stage(vertex)]] fn vertMain([[builtin(vertex_index)]] index : u32) -> VertOutput {
	var uv = vec2<f32>(f32(index % 2u), f32((index + 1u) % 6u / 3u));
	var position = vec4<f32>(uv * 2.0 - 1.0, 1.0, 1.0);
	return VertOutput(position, uv);
}

[[stage(fragment)]] fn fragMain(input : VertOutput) -> [[location(0)]] vec4<f32> {

	var uv = input.uv;
	uv.y = 1.0 - uv.y;


	// Mix the texture and bloom based on distance from center,
	// to approximate a lens blur
	var brightness = mix(
		textureSample( tex, linearSampler, uv ).rgb,
		textureSample( bloomTex, linearSampler, uv ).rgb,
		(0.7 - length(input.uv - 0.5))
	) * 1.25;

	// Dither: subtract a random value from the brightness
	brightness = brightness - randomFloat( uv + vec2<f32>(time.seconds) ) * config.ditherMagnitude;

	// Calculate a hue based on distance from center
	var hue = 0.35 + (length(input.uv - vec2<f32>(0.5, 1.0)) * -0.4 + 0.2);

	// Convert HSL to RGB
	var rgb = hslToRgb(hue, 0.8, max(0., brightness.r)) * vec3<f32>(0.8, 1.0, 0.7);

	// Calculate a separate RGB for upward-flowing glyphs
	var resurrectionRGB = hslToRgb(0.13, 1.0, max(0., brightness.g) * 0.9);
	return vec4<f32>(rgb + resurrectionRGB + config.backgroundColor, 1.0);
}
