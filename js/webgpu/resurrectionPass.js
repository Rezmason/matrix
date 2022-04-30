import { structs } from "../../lib/gpu-buffer.js";
import { loadShader, makeUniformBuffer, makeComputeTarget, makeBindGroup, makePass } from "./utils.js";

// Matrix Resurrections isn't in theaters yet,
// and this version of the effect is still a WIP.

// Criteria:
// Upward-flowing glyphs should be golden
// Downward-flowing glyphs should be tinted slightly blue on top and golden on the bottom
// Cheat a lens blur, interpolating between the texture and bloom at the edges

const numVerticesPerQuad = 2 * 3;

export default ({ config, device, timeBuffer }) => {
	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let configBuffer;
	let computeBindGroup;
	let output;
	let screenSize;

	const assets = [loadShader(device, "shaders/wgsl/resurrectionPass.wgsl")];

	const loaded = (async () => {
		const [resurrectionShader] = await Promise.all(assets);

		computePipeline = device.createComputePipeline({
			compute: {
				module: resurrectionShader.module,
				entryPoint: "computeMain",
			},
		});

		const configUniforms = structs.from(resurrectionShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, {
			bloomStrength: config.bloomStrength,
			ditherMagnitude: config.ditherMagnitude,
			backgroundColor: config.backgroundColor,
		});
	})();

	const build = (size, inputs) => {
		output?.destroy();
		output = makeComputeTarget(device, size);
		screenSize = size;

		computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			configBuffer,
			timeBuffer,
			linearSampler,
			inputs.primary.createView(),
			inputs.bloom.createView(),
			output.createView(),
		]);

		return {
			primary: output,
		};
	};

	const run = (encoder) => {
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.end();
	};

	return makePass(loaded, build, run);
};
