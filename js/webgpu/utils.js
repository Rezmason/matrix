const getCanvasSize = (canvas) => {
	const devicePixelRatio = window.devicePixelRatio ?? 1;
	return [canvas.clientWidth * devicePixelRatio, canvas.clientHeight * devicePixelRatio];
};

const loadTexture = async (device, url) => {
	const response = await fetch(url);
	const data = await response.blob();
	const imageBitmap = await createImageBitmap(data);

	const texture = device.createTexture({
		size: [imageBitmap.width, imageBitmap.height, 1],
		format: "rgba8unorm",
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
	});

	device.queue.copyExternalImageToTexture(
		{
			source: imageBitmap,
		},
		{
			texture: texture,
		},
		[imageBitmap.width, imageBitmap.height]
	);

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

const makePyramidView = (texture, level) =>
	texture.createView({
		baseMipLevel: level,
		mipLevelCount: 1,
		dimension: "2d",
	});

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

const makePipeline = (context, steps) => steps.filter((f) => f != null).map((f) => f(context));

export {
	getCanvasSize,
	makeRenderTarget,
	makeComputeTarget,
	make1DTexture,
	makePyramidView,
	loadTexture,
	loadShader,
	makeUniformBuffer,
	makePass,
	makePipeline,
	makeBindGroup,
};
