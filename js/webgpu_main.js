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
		usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT, // Which of these are necessary?
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

export default async (canvas, config) => {
	console.log(config);

	const NUM_VERTICES_PER_QUAD = 6;

	const numColumns = config.numColumns;
	const numRows = config.numColumns;

	if (navigator.gpu == null) {
		return;
	}

	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const canvasContext = canvas.getContext("webgpu");
	const presentationFormat = canvasContext.getPreferredFormat(adapter);
	const queue = device.queue;

	const canvasConfig = {
		device,
		format: presentationFormat,
		size: getCanvasSize(canvas),
	};

	canvasContext.configure(canvasConfig);

	const renderPassConfig = {
		colorAttachments: [
			{
				view: canvasContext.getCurrentTexture().createView(),
				loadValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
			},
		],
	};

	const sampler = device.createSampler();

	const msdfTexture = await loadTexture(device, config.glyphTexURL);

	const uniformBufferSize = 4 * (1 * 1 + 1 * 1);
	const uniformBuffer = device.createBuffer({
		size: uniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Which of these are necessary?
		mappedAtCreation: true,
	});
	new Int32Array(uniformBuffer.getMappedRange()).set([numColumns, numRows]);
	uniformBuffer.unmap();

	const msdfUniformBufferSize = 4 * (1 * 1);
	const msdfUniformBuffer = device.createBuffer({
		size: msdfUniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.FRAGMENT | GPUBufferUsage.COPY_DST, // Which of these are necessary?
		mappedAtCreation: true,
	});
	new Int32Array(msdfUniformBuffer.getMappedRange()).set([config.glyphTextureColumns]);
	msdfUniformBuffer.unmap();

	const timeBufferSize = 4 * (1 * 1 + 1 * 1);
	const timeBuffer = device.createBuffer({
		size: uniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.FRAGMENT | GPUBufferUsage.COMPUTE | GPUBufferUsage.COPY_DST, // Which of these are necessary?
	});

	const [rainRenderShader] = await Promise.all(["shaders/rainRenderPass.wgsl"].map(async (path) => (await fetch(path)).text()));

	const rainRenderShaderModule = device.createShaderModule({ code: rainRenderShader });

	const additiveBlendComponent = {
		operation: "add",
		srcFactor: "one",
		dstFactor: "one",
	};

	const additiveBlending = {
		color: additiveBlendComponent,
		alpha: additiveBlendComponent,
	};

	const rainRenderPipeline = device.createRenderPipeline({
		vertex: {
			module: rainRenderShaderModule,
			entryPoint: "vertMain",
		},
		fragment: {
			module: rainRenderShaderModule,
			entryPoint: "fragMain",
			targets: [
				{
					format: presentationFormat,
					blend: additiveBlending,
				},
			],
		},
		primitive: {
			// What happens if this isn't here?
			topology: "triangle-list", // What happens if this isn't here?
			cullMode: "back", // What happens if this isn't here?
		},
	});

	const uniformBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: uniformBuffer,
				},
			},
		],
	});

	const msdfBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(1),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: msdfUniformBuffer,
				},
			},
			{
				binding: 1,
				resource: sampler,
			},
			{
				binding: 2,
				resource: msdfTexture.createView(),
			},
		],
	});

	const timeBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(2),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: timeBuffer,
				},
			},
		],
	});

	const rainRenderPipelineBindGroups = [uniformBindGroup, msdfBindGroup, timeBindGroup];

	const bundleEncoder = device.createRenderBundleEncoder({
		colorFormats: [presentationFormat],
	});

	bundleEncoder.setPipeline(rainRenderPipeline);
	rainRenderPipelineBindGroups.forEach((bindGroup, index) => {
		bundleEncoder.setBindGroup(index, bindGroup);
	});
	const numQuads = numColumns * numRows;
	bundleEncoder.draw(NUM_VERTICES_PER_QUAD * numQuads, 1, 0, 0);
	const renderBundles = [bundleEncoder.finish()];

	let frame = 0;

	const renderLoop = (now) => {
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);

			// TODO: destroy and recreate all screen size textures

			// TODO: update camera matrix, screen size, write to queue
		}

		queue.writeBuffer(timeBuffer, 0, new Int32Array([now, frame]));
		frame++;

		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.executeBundles(renderBundles);
		renderPass.endPass();
		const commandBuffer = encoder.finish();
		queue.submit([commandBuffer]);

		requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
