import { makeComputeTarget, loadTexture, loadShader, makeUniformBuffer, makeBindGroup, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";

export default (context, getInputs) => {
	const { config, device } = context;

	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const assets = [loadTexture(device, bgURL), loadShader(device, "shaders/wgsl/imagePass.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let output;
	let screenSize;
	let backgroundTex;

	const getOutputs = () => ({
		primary: output,
	});

	const ready = (async () => {
		const [bgTex, imageShader] = await Promise.all(assets);

		backgroundTex = bgTex;

		computePipeline = device.createComputePipeline({
			compute: {
				module: imageShader.module,
				entryPoint: "computeMain",
			},
		});
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makeComputeTarget(device, width, height);
		screenSize = [width, height];
	};

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.bloom;
		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		const computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			linearSampler,
			tex.createView(),
			bloomTex.createView(),
			backgroundTex.createView(),
			output.createView(),
		]);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatch(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
