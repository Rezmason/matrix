import { structs } from "/lib/gpu-buffer.js";
import { loadShader, make1DTexture, makeUniformBuffer, makeBindGroup, makePassFBO, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a 1D gradient texture
// generated from the passed-in color sequence

// This shader introduces noise into the renders, to avoid banding

const transPrideStripeColors = [
	[0.3, 1.0, 1.0],
	[0.3, 1.0, 1.0],
	[1.0, 0.5, 0.8],
	[1.0, 0.5, 0.8],
	[1.0, 1.0, 1.0],
	[1.0, 1.0, 1.0],
	[1.0, 1.0, 1.0],
	[1.0, 0.5, 0.8],
	[1.0, 0.5, 0.8],
	[0.3, 1.0, 1.0],
	[0.3, 1.0, 1.0],
];

const prideStripeColors = [
	[1, 0, 0],
	[1, 0.5, 0],
	[1, 1, 0],
	[0, 1, 0],
	[0, 0, 1],
	[0.8, 0, 1],
];

const numVerticesPerQuad = 2 * 3;

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default (context, getInputs) => {
	const { config, device, timeBuffer, canvasFormat } = context;

	// Expand and convert stripe colors into 1D texture data
	const stripeColors =
		"stripeColors" in config ? config.stripeColors.split(",").map(parseFloat) : config.effect === "pride" ? prideStripeColors : transPrideStripeColors;

	const stripeTexture = make1DTexture(
		device,
		stripeColors.map((color) => [...color, 1])
	);

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
	let configBuffer;
	let output;

	const assets = [loadShader(device, "shaders/wgsl/stripePass.wgsl")];

	const ready = (async () => {
		const [stripeShader] = await Promise.all(assets);

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: stripeShader.module,
				entryPoint: "vertMain",
			},
			fragment: {
				module: stripeShader.module,
				entryPoint: "fragMain",
				targets: [
					{
						format: canvasFormat,
					},
				],
			},
		});

		const configUniforms = structs.from(stripeShader.code).Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { ditherMagnitude: 0.05, backgroundColor: config.backgroundColor });
	})();

	const setSize = (width, height) => {
		output?.destroy();
		output = makePassFBO(device, width, height, canvasFormat);
	};

	const getOutputs = () => ({
		primary: output,
	});

	const execute = (encoder) => {
		const inputs = getInputs();
		const tex = inputs.primary;
		const bloomTex = inputs.bloom; // TODO: bloom
		const renderBindGroup = makeBindGroup(device, renderPipeline, 0, [
			configBuffer,
			timeBuffer,
			linearSampler,
			tex.createView(),
			bloomTex.createView(),
			stripeTexture.createView(),
		]);

		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(getOutputs, ready, setSize, execute);
};
