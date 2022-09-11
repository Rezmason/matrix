import { structs } from "../../lib/gpu-buffer.js";
import { makeComputeTarget, makeUniformBuffer, loadShader, makeBindGroup, makePass } from "./utils.js";

let start;
const numTouches = 5;
const touches = Array(numTouches)
	.fill()
	.map((_) => [0, 0, -Infinity, 0]);
let aspectRatio = 1;

let index = 0;
let touchesChanged = true;
window.onclick = (e) => {
	touches[index][0] = 0 + e.clientX / e.srcElement.clientWidth;
	touches[index][1] = 1 - e.clientY / e.srcElement.clientHeight;
	touches[index][2] = (Date.now() - start) / 1000;
	index = (index + 1) % numTouches;
	touchesChanged = true;
};

export default ({ config, device, cameraTex, cameraAspectRatio, timeBuffer }) => {
	const assets = [loadShader(device, "shaders/wgsl/mirrorPass.wgsl")];

	const linearSampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
	});

	let computePipeline;
	let configBuffer;
	let sceneUniforms;
	let sceneBuffer;
	let touchUniforms;
	let touchBuffer;
	let output;
	let screenSize;
	let computeBindGroup;

	const loaded = (async () => {
		const [mirrorShader] = await Promise.all(assets);

		computePipeline = await device.createComputePipelineAsync({
			layout: "auto",
			compute: {
				module: mirrorShader.module,
				entryPoint: "computeMain",
			},
		});

		const mirrorShaderUniforms = structs.from(mirrorShader.code);

		const configUniforms = mirrorShaderUniforms.Config;
		configBuffer = makeUniformBuffer(device, configUniforms, { bloomStrength: config.bloomStrength });

		sceneUniforms = mirrorShaderUniforms.Scene;
		sceneBuffer = makeUniformBuffer(device, sceneUniforms);

		touchUniforms = mirrorShaderUniforms.Touches;
		touchBuffer = makeUniformBuffer(device, touchUniforms);
	})();

	const build = (size, inputs) => {
		output?.destroy();
		output = makeComputeTarget(device, size);
		screenSize = size;
		aspectRatio = size[0] / size[1];
		computeBindGroup = makeBindGroup(device, computePipeline, 0, [
			configBuffer,
			timeBuffer,
			sceneBuffer,
			touchBuffer,
			linearSampler,
			inputs.primary.createView(),
			inputs.bloom.createView(),
			cameraTex.createView(),
			output.createView(),
		]);

		const screenAspectRatio = size[0] / size[1];
		device.queue.writeBuffer(sceneBuffer, 0, sceneUniforms.toBuffer({ screenAspectRatio, cameraAspectRatio }));

		return { primary: output };
	};

	const run = (encoder) => {
		if (touchesChanged) {
			touchesChanged = false;
			device.queue.writeBuffer(touchBuffer, 0, touchUniforms.toBuffer({ touches }));
		}

		const computePass = encoder.beginComputePass();
		computePass.setPipeline(computePipeline);
		computePass.setBindGroup(0, computeBindGroup);
		computePass.dispatchWorkgroups(Math.ceil(screenSize[0] / 32), screenSize[1], 1);
		computePass.end();
	};

	start = Date.now();

	return makePass("Mirror", loaded, build, run);
};
