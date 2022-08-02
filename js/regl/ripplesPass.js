import { loadImage, loadText, makePassFBO, makePass } from "./utils.js";

let start = Date.now();
const numClicks = 5;
const clicks = Array(numClicks).fill([0, 0, -Infinity]).flat();
let aspectRatio = 1;

let index = 0;
window.onclick = (e) => {
	clicks[index * 3 + 0] = 0 + e.clientX / e.srcElement.clientWidth;
	clicks[index * 3 + 1] = 1 - e.clientY / e.srcElement.clientHeight;
	clicks[index * 3 + 2] = (Date.now() - start) / 1000;
	index = (index + 1) % numClicks;
}

// TODO: switch to video-based texture
// TODO: mipmap?
const video = document.createElement("video");
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");
let cameraAspectRatio = 1.0;

const getCameraFeed = async () => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({video: {
			width: { min: 800, ideal: 1280 },
			frameRate: { ideal: 60 }
		}, audio: false});
		const videoTrack = stream.getVideoTracks()[0];
		const {width, height} = videoTrack.getSettings();
		console.log(videoTrack.getSettings());

		video.width = width;
		video.height = height;
		canvas.width = width;
		canvas.height = height;
		cameraAspectRatio = width / height;

		video.srcObject = stream;
		video.play();
	} catch (e) {}
};

export default ({ regl, config }, inputs) => {

	getCameraFeed();
	const cameraTex = regl.texture(canvas);

	start = Date.now();

	const output = makePassFBO(regl, config.useHalfFloat);
	const ripplesPassFrag = loadText("shaders/glsl/ripplesPass.frag.glsl");
	const render = regl({
		frag: regl.prop("frag"),
		uniforms: {
			time: regl.context("time"),
			tex: inputs.primary,
			bloomTex: inputs.bloom,
			cameraTex,
			clicks: () => clicks,
			aspectRatio: () => aspectRatio,
			cameraAspectRatio: () => cameraAspectRatio
		},
		framebuffer: output,
	});
	return makePass(
		{
			primary: output,
		},
		Promise.all([ripplesPassFrag.loaded]),
		(w, h) => {
			output.resize(w, h);
			aspectRatio = w / h;
		},
		() => {
			context.drawImage(video, 0, 0);
			cameraTex(canvas);
			render({ frag: ripplesPassFrag.text() });
		}
	);
};
