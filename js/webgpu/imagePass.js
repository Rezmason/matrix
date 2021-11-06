import std140 from "./std140.js";
import { loadTexture, loadShaderModule, makeUniformBuffer, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";
const numVerticesPerQuad = 2 * 3;

export default (context, getInputs) => {
	const { config, adapter, device, canvasContext } = context;
	const ditherMagnitude = 0.05;

	const configLayout = std140(["f32", "vec3<f32>"]);
	const configBuffer = makeUniformBuffer(device, configLayout, [ditherMagnitude, config.backgroundColor]);

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

	const presentationFormat = canvasContext.getPreferredFormat(adapter);

	let renderPipeline;
	let output;
	let backgroundTex;

	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const assets = [loadTexture(device, bgURL), loadShaderModule(device, "shaders/wgsl/imagePass.wgsl")];

	const ready = (async () => {
		const [bgTex, rainShader] = await Promise.all(assets);

		backgroundTex = bgTex;

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: rainShader,
				entryPoint: "vertMain",
			},
			fragment: {
				module: rainShader,
				entryPoint: "fragMain",
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
		});
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makePassFBO(device, width, height, presentationFormat);
	};

	const getOutputs = () => ({
		primary: output,
	});

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.primary; // TODO: bloom
		const renderBindGroup = device.createBindGroup({
			layout: renderPipeline.getBindGroupLayout(0),
			entries: [linearSampler, tex.createView(), bloomTex.createView(), backgroundTex.createView()]
				.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
				.map((resource, binding) => ({
					binding,
					resource,
				})),
		});

		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(ready, setSize, getOutputs, execute);
};
