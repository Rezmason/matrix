struct Config {
	bloomStrength : f32,
};

struct Time {
	seconds : f32,
	frames : i32,
};

struct Touches {
	touches : array<vec4<f32>, 5>,
};

struct Scene {
	screenAspectRatio : f32,
	cameraAspectRatio : f32,
};

@group(0) @binding(0) var<uniform> config : Config;
@group(0) @binding(1) var<uniform> time : Time;
@group(0) @binding(2) var<uniform> scene : Scene;
@group(0) @binding(3) var<uniform> touches : Touches;
@group(0) @binding(4) var linearSampler : sampler;
@group(0) @binding(5) var tex : texture_2d<f32>;
@group(0) @binding(6) var bloomTex : texture_2d<f32>;
@group(0) @binding(7) var cameraTex : texture_2d<f32>;
@group(0) @binding(8) var outputTex : texture_storage_2d<rgba8unorm, write>;

struct ComputeInput {
	@builtin(global_invocation_id) id : vec3<u32>,
};

fn getBrightness(uv : vec2<f32>, intensity : f32) -> vec4<f32> {

	var primary = textureSampleLevel(tex, linearSampler, uv, 0.0);
	var bloom = textureSampleLevel(bloomTex, linearSampler, uv, 0.0) * config.bloomStrength;

	return primary * (1.0 + intensity * 0.3) + bloom * 0.5;
}

@compute @workgroup_size(32, 1, 1) fn computeMain(input : ComputeInput) {

	// Resolve the invocation ID to a texel coordinate
	var coord = vec2<i32>(input.id.xy);
	var screenSize = textureDimensions(tex);

	if (coord.x >= screenSize.x) {
		return;
	}

	var uv = vec2<f32>(coord) / vec2<f32>(screenSize);

	var intensity = 0.0;
	for (var i = 0; i < 5; i++) {
		var touch = touches.touches[i];
		touch.y = 1.0 - touch.y;
		var distanceToClick = length((touch.xy - uv) * vec2(scene.screenAspectRatio, 1.0));
		var elapsedTime = clamp(time.seconds - touch.z, -100.0, 100.0);
		var t = distanceToClick - elapsedTime * 0.5;
		intensity += sin(t * 40.0) / t;
	}
	intensity *= 0.2;

	var rippledUV = uv + intensity * 0.001;

	var webcamAspectAdjust = scene.cameraAspectRatio / scene.screenAspectRatio;
	var webcamTransform = vec2<f32>(1.0, webcamAspectAdjust);
	if (webcamAspectAdjust > 1.0) {
		webcamTransform = vec2<f32>(1.0 / webcamAspectAdjust, 1.0);
	}
	var webcamUV = ((rippledUV - 0.5) * webcamTransform) + 0.5;

	var webcam = textureSampleLevel(cameraTex, linearSampler, webcamUV, 0.0).rgb;
	webcam *= mix(vec3<f32>(0.1, 0.3, 0.0), vec3<f32>(0.9, 1.0, 0.7), 1.0 - length(uv - 0.5) * 1.5);

	var code = mix(webcam, vec3<f32>(0.7, 1.0, 0.4), getBrightness(rippledUV, intensity).r);
	textureStore(outputTex, coord, vec4<f32>(code, 1.0));
}
