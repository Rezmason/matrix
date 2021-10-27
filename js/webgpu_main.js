const getCanvasSize = (canvas) => {
	const devicePixelRatio = window.devicePixelRatio ?? 1;
	return [canvas.clientWidth * devicePixelRatio, canvas.clientHeight * devicePixelRatio];
};

export default async (canvas, config) => {
	console.log(config);

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

	// TODO: create buffers, uniforms, textures, samplers

	const uniformBufferSize = 4 * (1 + 1);
	const uniformBuffer = device.createBuffer({
		size: uniformBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, // Which of these are necessary?
		mappedAtCreation: true,
	});
	new Int32Array(uniformBuffer.getMappedRange()).set([numColumns, numRows]);
	uniformBuffer.unmap();

	// TODO: create pipelines, bind groups, shaders

	const [vert, frag] = await Promise.all(["shaders/rainPass.vert.wgsl", "shaders/rainPass.frag.wgsl"].map(async (path) => (await fetch(path)).text()));

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
			module: device.createShaderModule({
				code: vert,
			}),
			entryPoint: "main",
		},
		fragment: {
			module: device.createShaderModule({
				code: frag,
			}),
			entryPoint: "main",
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
			cullMode: "none", // What happens if this isn't here?
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

	const bundleEncoder = device.createRenderBundleEncoder({
		colorFormats: [presentationFormat],
	});

	bundleEncoder.setPipeline(rainRenderPipeline);
	bundleEncoder.setBindGroup(0, uniformBindGroup);
	bundleEncoder.draw(6 * numColumns * numRows, 1, 0, 0);
	const renderBundles = [bundleEncoder.finish()];

	// queue.writeBuffer(uniformBuffer, 0, new Int32Array([numColumns, numRows]));

	const frame = (now) => {
		const canvasSize = getCanvasSize(canvas);
		if (canvasSize[0] !== canvasConfig.size[0] || canvasSize[1] !== canvasConfig.size[1]) {
			canvasConfig.size = canvasSize;
			canvasContext.configure(canvasConfig);

			// TODO: destroy and recreate all screen size textures

			// TODO: update camera matrix, screen size, write to queue
		}

		// TODO: update the uniforms that change, write to queue

		renderPassConfig.colorAttachments[0].loadValue.r = Math.sin((now / 1000) * 2) / 2 + 0.5;
		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.executeBundles(renderBundles);
		renderPass.endPass();
		const commandBuffer = encoder.finish();
		queue.submit([commandBuffer]);

		requestAnimationFrame(frame);
	};

	requestAnimationFrame(frame);
};
