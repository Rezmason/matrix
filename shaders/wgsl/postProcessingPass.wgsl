[[block]] struct Config {
	foo : i32;
};

// The properties that change over time get their own buffer.
[[block]] struct Time {
	seconds : f32;
	frames : i32;
};

[[group(0), binding(0)]] var<uniform> config : Config;
[[group(0), binding(1)]] var<uniform> time : Time;

[[group(0), binding(2)]] var inputTex : texture_2d<f32>;
[[group(0), binding(3)]] var outputTex : texture_storage_2d<rgba8unorm, write>;

// Shader params

struct ComputeInput {
	[[builtin(global_invocation_id)]] id : vec3<u32>;
};

// Constants

let NUM_VERTICES_PER_QUAD : i32 = 6; // 2 * 3
let PI : f32 = 3.14159265359;
let TWO_PI : f32 = 6.28318530718;
let SQRT_2 : f32 = 1.4142135623730951;
let SQRT_5 : f32 = 2.23606797749979;

// Helper functions for generating randomness, borrowed from elsewhere

fn randomFloat( uv : vec2<f32> ) -> f32 {
	let a = 12.9898;
	let b = 78.233;
	let c = 43758.5453;
	let dt = dot( uv, vec2<f32>( a, b ) );
	let sn = dt % PI;
	return fract(sin(sn) * c);
}

fn randomVec2( uv : vec2<f32> ) -> vec2<f32> {
	return fract(vec2<f32>(sin(uv.x * 591.32 + uv.y * 154.077), cos(uv.x * 391.32 + uv.y * 49.077)));
}

fn wobble(x : f32) -> f32 {
	return x + 0.3 * sin(SQRT_2 * x) + 0.2 * sin(SQRT_5 * x);
}

[[stage(compute), workgroup_size(32, 1, 1)]] fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a single cell
	var coord = vec2<i32>(input.id.xy);
	var screenSize = textureDimensions(inputTex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var foo = config.foo;
	var seconds = time.seconds;

	var inputColor = textureLoad(inputTex, coord, 0);
	var outputColor = inputColor;
	textureStore(outputTex, coord, outputColor);
}
