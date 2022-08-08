/*
const loadTexture = async (device, url) => {
	const response = await fetch(url);
	const data = await response.blob();
	const source = await createImageBitmap(data);
	const size = [source.width, source.height, 1];

	const texture = device.createTexture({
		size,
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

	device.queue.copyExternalImageToTexture({ source }, { texture }, size);

	return texture;
};
*/

const loadTexture = async (device, url) => {
	const image = new Image();
	image.crossOrigin = "Anonymous";
	image.src = url;
	await image.decode();
	const { width, height } = image;
	const size = [width, height, 1];

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0);
	const source = ctx.getImageData(0, 0, width, height).data;

	const texture = device.createTexture({
		size,
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

	device.queue.writeTexture({ texture }, source, { bytesPerRow: 4 * width }, size);

	return texture;
};

const makeRenderTarget = (device, size, format, mipLevelCount = 1) =>
	device.createTexture({
		size: [...size, 1],
		mipLevelCount,
		format,
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

const makeComputeTarget = (device, size, mipLevelCount = 1) =>
	device.createTexture({
		size: [...size, 1],
		mipLevelCount,
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING,
	});

const loadShader = async (device, url) => {
	const response = await fetch(url);
	const code = await response.text();
	return {
		code,
		module: device.createShaderModule({ code }),
	};
};

const makeUniformBuffer = (device, uniforms, data = null) => {
	const buffer = device.createBuffer({
		size: uniforms.minSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: data != null,
	});
	if (data != null) {
		uniforms.toBuffer(data, buffer.getMappedRange());
		buffer.unmap();
	}
	return buffer;
};

const make1DTexture = (device, rgbas) => {
	const size = [rgbas.length];
	const texture = device.createTexture({
		size,
		// dimension: "1d",
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
	});
	const data = new Uint8ClampedArray(rgbas.map((color) => color.map((f) => f * 0xff)).flat());
	device.queue.writeTexture({ texture }, data, {}, size);
	return texture;
};

const makeBindGroup = (device, pipeline, index, entries) =>
	device.createBindGroup({
		layout: pipeline.getBindGroupLayout(index),
		entries: entries
			.map((resource) => (resource instanceof GPUBuffer ? { buffer: resource } : resource))
			.map((resource, binding) => ({
				binding,
				resource,
			})),
	});

const makePass = (loaded, build, run) => ({
	loaded: loaded ?? Promise.resolve(),
	build: build ?? ((size, inputs) => inputs),
	run: run ?? (() => {}),
});

const makePipeline = async (context, steps) => {
	steps = steps.filter((f) => f != null).map((f) => f(context));
	await Promise.all(steps.map((step) => step.loaded));
	return {
		steps,
		build: (canvasSize) => steps.reduce((outputs, step) => step.build(canvasSize, outputs), null),
		run: (encoder) => steps.forEach((step) => step.run(encoder)),
	};
};

export { makeRenderTarget, makeComputeTarget, make1DTexture, loadTexture, loadShader, makeUniformBuffer, makePass, makePipeline, makeBindGroup };
