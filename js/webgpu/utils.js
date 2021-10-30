const getCanvasSize = (canvas) => {
	const devicePixelRatio = window.devicePixelRatio ?? 1;
	return [canvas.clientWidth * devicePixelRatio, canvas.clientHeight * devicePixelRatio];
};

const loadTexture = async (device, url) => {
	const image = new Image();
	image.crossOrigin = "anonymous";
	image.src = url;
	await image.decode();
	const imageBitmap = await createImageBitmap(image);

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

const makeUniformBuffer = (device, structLayout, values = null) => {
	const buffer = device.createBuffer({
		size: structLayout.size,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		mappedAtCreation: values != null,
	});
	if (values != null) {
		structLayout.build(values, buffer.getMappedRange());
		buffer.unmap();
	}
	return buffer;
};

export { getCanvasSize, loadTexture, makeUniformBuffer };
