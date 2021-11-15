import { loadShader, makeBindGroup, makePass } from "./utils.js";

const numVerticesPerQuad = 2 * 3;

export default (context) => {
	const { config, device, canvasFormat, canvasContext } = context;

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
	let renderBindGroup;

	const assets = [loadShader(device, "shaders/wgsl/endPass.wgsl")];

	const loaded = (async () => {
		const [imageShader] = await Promise.all(assets);

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

	const build = (size, inputs) => {
		renderBindGroup = makeBindGroup(device, renderPipeline, 0, [linearSampler, inputs.primary.createView()]);
		return null;
	};

	const run = (encoder) => {
		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(loaded, build, run);
};
