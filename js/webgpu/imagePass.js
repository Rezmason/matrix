import { structs } from "../../lib/gpu-buffer.js";
import { makeComputeTarget, makeUniformBuffer, loadTexture, loadShader, makeBindGroup, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";

export default ({ config, device }) => {
	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const assets = [loadTexture(device, bgURL), loadShader(device, "shaders/wgsl/imagePass.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let configBuffer;
	let output;
	let screenSize;
	let backgroundTex;
	let computeBindGroup;

	const loaded = (async () => {
		const [bgTex, imageShader] = await Promise.all(assets);

		backgroundTex = bgTex;

		computePipeline = device.createComputePipeline({
			compute: {
				module: imageShader.module,
				entryPoint: "computeMain",
			},
		});

		const configUniforms = structs.from(imageShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { bloomStrength: config.bloomStrength });
	})();

	const build = (size, inputs) => {
		output?.destroy();
		output = makeComputeTarget(device, size);
		screenSize = size;
		computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			configBuffer,
			linearSampler,
			inputs.primary.createView(),
			inputs.bloom.createView(),
			backgroundTex.createView(),
			output.createView(),
		]);
		return { primary: output };
	};

	const run = (encoder) => {
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.endPass();
	};

	return makePass(loaded, build, run);
};
