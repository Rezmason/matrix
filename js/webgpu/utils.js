const getCanvasSize = (canvas) => {
	const devicePixelRatio = window.devicePixelRatio ?? 1;
	return [canvas.clientWidth * devicePixelRatio, canvas.clientHeight * devicePixelRatio];
};

const loadTexture = async (device, url) => {
	const response = await fetch(url, { credentials: "include" });
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

const loadShaderModule = async (device, url) => {
	const response = await fetch(url);
	const code = await response.text();
	return device.createShaderModule({ code });
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

const makePass = (outputs, ready, setSize, execute) => {
	if (ready == null) {
		ready = Promise.resolve();
	} else if (ready instanceof Array) {
		ready = Promise.all(ready);
	}

	return {
		outputs,
		ready,
		setSize,
		execute,
	};
};

export { getCanvasSize, loadTexture, loadShaderModule, makeUniformBuffer, makePass };
