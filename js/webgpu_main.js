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
	const THIRTY_TWO_BITS = 4; // 4 bytes = 32 bits

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

	const configBufferSize = THIRTY_TWO_BITS * (1 * 1 + 1 * 1);
	const configBuffer = device.createBuffer({
		size: configBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Which of these are necessary?
		mappedAtCreation: true,
	});
	new Int32Array(configBuffer.getMappedRange()).set([numColumns, numRows]);
	configBuffer.unmap();

	const msdfBufferSize = THIRTY_TWO_BITS * (1 * 1);
	const msdfBuffer = device.createBuffer({
		size: msdfBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.FRAGMENT | GPUBufferUsage.COPY_DST, // Which of these are necessary?
		mappedAtCreation: true,
	});
	new Int32Array(msdfBuffer.getMappedRange()).set([config.glyphTextureColumns]);
	msdfBuffer.unmap();

	const timeBufferSize = THIRTY_TWO_BITS * (1 * 1 + 1 * 1);
	const timeBuffer = device.createBuffer({
		size: configBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.FRAGMENT | GPUBufferUsage.COMPUTE | GPUBufferUsage.COPY_DST, // Which of these are necessary?
	});

	const cameraBufferSize = THIRTY_TWO_BITS * (1 * 2);
	const cameraBuffer = device.createBuffer({
		size: configBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.COMPUTE | GPUBufferUsage.COPY_DST, // Which of these are necessary?
	});

	const updateCameraBuffer = () => {
		const canvasSize = canvasConfig.size;
		const aspectRatio = canvasSize[0] / canvasSize[1];
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		queue.writeBuffer(cameraBuffer, 0, new Float32Array(screenSize));
	}
	updateCameraBuffer();

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

	const configBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: configBuffer,
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
					buffer: msdfBuffer,
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

	const cameraBindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(3),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: cameraBuffer,
				},
			},
		],
	});

	const rainRenderPipelineBindGroups = [configBindGroup, msdfBindGroup, timeBindGroup, cameraBindGroup];

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

			updateCameraBuffer();
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
