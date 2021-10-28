let NUM_VERTICES_PER_QUAD:i32 = 6;
let PI:f32 = 3.14159265359;
let TWO_PI:f32 = 6.28318530718; // No, I'm not using Tau.

[[block]] struct Uniforms {
	numColumns: i32;
	numRows: i32;
};
[[group(0), binding(0)]] var<uniform> uniforms:Uniforms;

[[block]] struct MSDFUniforms {
	numColumns: i32;
};
[[group(0), binding(1)]] var<uniform> msdfUniforms:MSDFUniforms;
[[group(0), binding(2)]] var msdfSampler: sampler;
[[group(0), binding(3)]] var msdfTexture: texture_2d<f32>;

[[block]] struct TimeUniforms {
	now: i32;
	frame: i32;
};
[[group(0), binding(4)]] var<uniform> timeUniforms:TimeUniforms;

[[block]] struct CameraUniforms {
	screenSize: vec2<f32>;
	camera: mat4x4<f32>;
	transform: mat4x4<f32>;
};
[[group(0), binding(5)]] var<uniform> cameraUniforms:CameraUniforms;

// Vertex shader

struct VertexOutput {
	[[builtin(position)]] Position:vec4<f32>;
	[[location(0)]] UV:vec2<f32>;
};

[[stage(vertex)]] fn vertMain([[builtin(vertex_index)]] VertexIndex:u32) -> VertexOutput {

	var i = i32(VertexIndex);
	var quadIndex = i / NUM_VERTICES_PER_QUAD;

	var cornerPosition = vec2<f32>(
		f32(i % 2),
		f32(((i + 1) % NUM_VERTICES_PER_QUAD / 3))
	);

	var position = cornerPosition;
	position = position + vec2<f32>(
		f32(quadIndex % uniforms.numColumns),
		f32(quadIndex / uniforms.numColumns)
	);
	position = position / vec2<f32>(
		f32(uniforms.numColumns),
		f32(uniforms.numRows)
	);
	position = 1.0 - position * 2.0;
	position = position * cameraUniforms.screenSize;

	return VertexOutput(
		vec4<f32>(position, 1.0, 1.0),
		cornerPosition
	);
}

// Fragment shader

[[stage(fragment)]] fn fragMain([[location(0)]] UV:vec2<f32>) -> [[location(0)]] vec4<f32> {
	var msdf:vec4<f32> = textureSample(msdfTexture, msdfSampler, UV / f32(msdfUniforms.numColumns));
	// msdf.b = msdf.b * (sin(f32(timeUniforms.now) / 1000.0 * TWO_PI) * 0.5 + 0.5);
	msdf.b = msdf.b * f32(timeUniforms.frame / 60 % 2);
	var now = timeUniforms.now;

	return msdf;
}
