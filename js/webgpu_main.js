const { mat4, vec3 } = glMatrix;

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

const supportedLayoutTypes = {
	["i32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "i32" },
	["u32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "u32" },
	["f32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "f32" },

	["atomic<i32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "i32" },
	["vec2<i32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "i32" },
	["vec3<i32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "i32" },
	["vec4<i32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "i32" },

	["atomic<u32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "u32" },
	["vec2<u32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "u32" },
	["vec3<u32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "u32" },
	["vec4<u32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "u32" },

	["atomic<f32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "f32" },
	["vec2<f32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "f32" },
	["vec3<f32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "f32" },
	["vec4<f32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "f32" },

	["mat2x2<f32>"]: { alignAtByte: 2, sizeInBytes: 4, baseType: "f32" },
	["mat3x2<f32>"]: { alignAtByte: 2, sizeInBytes: 6, baseType: "f32" },
	["mat4x2<f32>"]: { alignAtByte: 2, sizeInBytes: 8, baseType: "f32" },
	["mat2x3<f32>"]: { alignAtByte: 4, sizeInBytes: 8, baseType: "f32" },
	["mat3x3<f32>"]: { alignAtByte: 4, sizeInBytes: 12, baseType: "f32" },
	["mat4x3<f32>"]: { alignAtByte: 4, sizeInBytes: 16, baseType: "f32" },
	["mat2x4<f32>"]: { alignAtByte: 4, sizeInBytes: 8, baseType: "f32" },
	["mat3x4<f32>"]: { alignAtByte: 4, sizeInBytes: 12, baseType: "f32" },
	["mat4x4<f32>"]: { alignAtByte: 4, sizeInBytes: 16, baseType: "f32" },
};

const computeStructLayout = (types) => {
	const entries = [];
	let byteOffset = 0;
	for (const type of types) {
		if (supportedLayoutTypes[type] == null) {
			throw new Error(`Unsupported type: ${type}`);
		}
		const { alignAtByte, sizeInBytes, baseType } = supportedLayoutTypes[type];
		byteOffset = Math.ceil(byteOffset / alignAtByte) * alignAtByte;
		entries.push({ baseType, byteOffset });
		byteOffset += sizeInBytes;
	}

	// console.log(types);
	// console.log(entries);

	return {
		entries,
		size: byteOffset * Float32Array.BYTES_PER_ELEMENT,
	};
};

const buildStruct = (buffer, layout, values) => {
	const { entries } = layout;

	if (values.length !== entries.length) {
		throw new Error(`This struct contains ${entries.length} values, and you supplied ${values.length}.`);
	}

	buffer ??= new ArrayBuffer(layout.size);

	const views = {
		i32: new Int32Array(buffer),
		u32: new Uint32Array(buffer),
		f32: new Float32Array(buffer),
	};

	for (let i = 0; i < values.length; i++) {
		const view = views[entries[i].baseType];
		const value = values[i];
		const array = value[Symbol.iterator] == null ? [value] : value;
		view.set(array, entries[i].byteOffset);
	}
	return buffer;
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

	const configStructLayout = computeStructLayout(["i32", "i32", "f32"]);
	const configBufferSize = configStructLayout.size;
	const configBuffer = device.createBuffer({
		size: configBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.FRAGMENT, // Which of these are necessary?
		mappedAtCreation: true,
	});
	buildStruct(configBuffer.getMappedRange(), configStructLayout, [numColumns, numRows, config.glyphHeightToWidth]);
	configBuffer.unmap();

	// prettier-ignore
	const msdfStructLayout = computeStructLayout(["i32", "i32"]);
	const msdfBuffer = device.createBuffer({
		size: msdfStructLayout.size,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.FRAGMENT, // Which of these are necessary?
		mappedAtCreation: true,
	});
	buildStruct(msdfBuffer.getMappedRange(), msdfStructLayout, [config.glyphTextureColumns, config.glyphSequenceLength]);
	msdfBuffer.unmap();

	// prettier-ignore
	const timeStructLayout = computeStructLayout(["i32", "i32"]);
	const timeBuffer = device.createBuffer({
		size: timeStructLayout.size,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.FRAGMENT | GPUBufferUsage.COMPUTE | GPUBufferUsage.COPY_DST, // Which of these are necessary?
	});

	// prettier-ignore
	const sceneStructLayout = computeStructLayout(["vec2<f32>", "mat4x4<f32>", "mat4x4<f32>"]);
	const sceneBuffer = device.createBuffer({
		size: sceneStructLayout.size,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.VERTEX | GPUBufferUsage.COMPUTE | GPUBufferUsage.COPY_DST, // Which of these are necessary?
	});

	const camera = mat4.create();
	const translation = vec3.set(vec3.create(), 0, 0, -1);
	const scale = vec3.set(vec3.create(), 1, 1, 1);
	const transform = mat4.create();
	mat4.translate(transform, transform, translation);
	mat4.scale(transform, transform, scale);

	const updateCameraBuffer = () => {
		const canvasSize = canvasConfig.size;
		const aspectRatio = canvasSize[0] / canvasSize[1];
		mat4.perspectiveZO(camera, (Math.PI / 180) * 90, aspectRatio, 0.0001, 1000);
		const screenSize = aspectRatio > 1 ? [1, aspectRatio] : [1 / aspectRatio, 1];
		queue.writeBuffer(sceneBuffer, 0, buildStruct(null, sceneStructLayout, [screenSize, camera, transform]));
	};
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

	console.log(device.limits);

	const bindGroup = device.createBindGroup({
		layout: rainRenderPipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: {
					buffer: configBuffer,
				},
			},
			{
				binding: 1,
				resource: {
					buffer: msdfBuffer,
				},
			},
			{
				binding: 2,
				resource: sampler,
			},
			{
				binding: 3,
				resource: msdfTexture.createView(),
			},
			{
				binding: 4,
				resource: {
					buffer: timeBuffer,
				},
			},
			{
				binding: 5,
				resource: {
					buffer: sceneBuffer,
				},
			},
		],
	});

	const bundleEncoder = device.createRenderBundleEncoder({
		colorFormats: [presentationFormat],
	});

	bundleEncoder.setPipeline(rainRenderPipeline);
	bundleEncoder.setBindGroup(0, bindGroup);
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

		queue.writeBuffer(timeBuffer, 0, buildStruct(null, timeStructLayout, [now, frame]));
		frame++;

		renderPassConfig.colorAttachments[0].view = canvasContext.getCurrentTexture().createView();

		const encoder = device.createCommandEncoder();
		const renderPass = encoder.beginRenderPass(renderPassConfig);
		renderPass.executeBundles(renderBundles);
		renderPass.endPass();
		const commandBuffer = encoder.finish();
		queue.submit([commandBuffer]);

		// requestAnimationFrame(renderLoop);
	};

	requestAnimationFrame(renderLoop);
};
