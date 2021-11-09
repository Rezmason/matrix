import { structs } from "/lib/gpu-buffer.js";
import { loadShader, makeUniformBuffer, makeBindGroup, makePassFBO, makePass } from "./utils.js";

// Maps the brightness of the rendered rain and bloom to colors
// in a linear gradient buffer generated from the passed-in color sequence

// This shader introduces noise into the renders, to avoid banding

const colorToRGB = ([hue, saturation, lightness]) => {
	const a = saturation * Math.min(lightness, 1 - lightness);
	const f = (n) => {
		const k = (n + hue * 12) % 12;
		return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [f(0), f(8), f(4)];
};

const numVerticesPerQuad = 2 * 3;

const makePalette = (device, paletteUniforms, entries) => {
	const PALETTE_SIZE = 512;
	const paletteColors = Array(PALETTE_SIZE);

	// Convert HSL gradient into sorted RGB gradient, capping the ends
	const sortedEntries = entries
		.slice()
		.sort((e1, e2) => e1.at - e2.at)
		.map((entry) => ({
			rgb: colorToRGB(entry.hsl),
			arrayIndex: Math.floor(Math.max(Math.min(1, entry.at), 0) * (PALETTE_SIZE - 1)),
		}));
	sortedEntries.unshift({ rgb: sortedEntries[0].rgb, arrayIndex: 0 });
	sortedEntries.push({
		rgb: sortedEntries[sortedEntries.length - 1].rgb,
		arrayIndex: PALETTE_SIZE - 1,
	});

	// Interpolate between the sorted RGB entries to generate
	// the palette texture data
	sortedEntries.forEach((entry, index) => {
		paletteColors[entry.arrayIndex] = entry.rgb.slice();
		if (index + 1 < sortedEntries.length) {
			const nextEntry = sortedEntries[index + 1];
			const diff = nextEntry.arrayIndex - entry.arrayIndex;
			for (let i = 0; i < diff; i++) {
				const ratio = i / diff;
				paletteColors[entry.arrayIndex + i] = [
					entry.rgb[0] * (1 - ratio) + nextEntry.rgb[0] * ratio,
					entry.rgb[1] * (1 - ratio) + nextEntry.rgb[1] * ratio,
					entry.rgb[2] * (1 - ratio) + nextEntry.rgb[2] * ratio,
				];
			}
		}
	});

	// TODO: try using gpu-uniforms

	const paletteBuffer = device.createBuffer({
		size: (3 + 1) * PALETTE_SIZE * Float32Array.BYTES_PER_ELEMENT,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: true,
	});

	const view = new Float32Array(paletteBuffer.getMappedRange());
	for (let i = 0; i < paletteColors.length; i++) {
		view.set(paletteColors[i], (3 + 1) * i);
	}

	paletteBuffer.unmap();

	return paletteBuffer;
};

// The rendered texture's values are mapped to colors in a palette texture.
// A little noise is introduced, to hide the banding that appears
// in subtle gradients. The noise is also time-driven, so its grain
// won't persist across subsequent frames. This is a safe trick
// in screen space.

export default (context, getInputs) => {
	const { config, adapter, device, canvasContext, timeBuffer } = context;

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
	let configBuffer;
	let paletteBuffer;
	let output;

	const assets = [loadShader(device, "shaders/wgsl/palettePass.wgsl")];

	const ready = (async () => {
		const [paletteShader] = await Promise.all(assets);

		renderPipeline = device.createRenderPipeline({
			vertex: {
				module: paletteShader.module,
				entryPoint: "vertMain",
			},
			fragment: {
				module: paletteShader.module,
				entryPoint: "fragMain",
				targets: [
					{
						format: presentationFormat,
					},
				],
			},
		});

		const paletteShaderUniforms = structs.from(paletteShader.code);
		const configUniforms = paletteShaderUniforms.Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { ditherMagnitude: 0.05, backgroundColor: config.backgroundColor });

		const paletteUniforms = paletteShaderUniforms.Palette;
		paletteBuffer = makePalette(device, paletteUniforms, config.paletteEntries);
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
		const renderBindGroup = makeBindGroup(device, renderPipeline, 0, [
			configBuffer,
			paletteBuffer,
			timeBuffer,
			linearSampler,
			tex.createView(),
			bloomTex.createView(),
		]);

		renderPassConfig.colorAttachments[0].view = output.createView();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.setPipeline(renderPipeline);
		renderPass.setBindGroup(0, renderBindGroup);
		renderPass.draw(numVerticesPerQuad, 1, 0, 0);
		renderPass.endPass();
	};

	return makePass(ready, setSize, getOutputs, execute);
};
