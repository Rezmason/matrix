import { loadTexture, loadShader, makeBindGroup, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";
const numVerticesPerQuad = 2 * 3;

export default (context, getInputs) => {
	const { config, device, canvasFormat } = context;

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	const renderPassConfig = {
		colorAttachments: [
			{
				view: null,
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	let renderPipeline;
	let output;
	let backgroundTex;

	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const assets = [loadTexture(device, bgURL), loadShader(device, "shaders/wgsl/imagePass.wgsl")];

	const getOutputs = () => ({
		primary: output,
	});

	const ready = (async () => {
		const [bgTex, imageShader] = await Promise.all(assets);

		backgroundTex = bgTex;

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: imageShader.module,
				entryPoint: "vertMain",
			},
			fragment: {
				module: imageShader.module,
				entryPoint: "fragMain",
				targets: [
					{
						format: canvasFormat,
					},
				],
			},
		});
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makePassFBO(device, width, height, canvasFormat);
	};

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.bloom; // TODO: bloom
		const renderBindGroup = makeBindGroup(device, renderPipeline, 0, [linearSampler, tex.createView(), bloomTex.createView(), backgroundTex.createView()]);
		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
