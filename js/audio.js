// pentatonic major: 0, 2, 4, 7,  9
// pentatonic minor: 0, 3, 5, 7, 10
const notes = [0, 3, 5, 7, 10].map((note) => 2 ** (note / 12 - 0.25));

const audioCodecs = [
	{ codec: "audio/webm; codecs=vorbis", extension: "webm" },
	{ codec: "audio/mp4; codecs=mp4a.40.5", extension: "m4a" },
	{ codec: "audio/wav; codecs=1", extension: "wav" },
];

const extension = (() => {
	const audio = new Audio();
	return audioCodecs.find(({ codec }) => audio.canPlayType(codec))?.extension;
})();

const context = new AudioContext();

// Borrowed from Oskar Eriksson's web audio examples
const slapback = (() => {
	const input = context.createGain();
	const output = context.createGain();
	const delay = context.createDelay();
	const feedback = context.createGain();
	const wetLevel = context.createGain();

	delay.delayTime.value = 0.15;
	feedback.gain.value = 0.25;
	wetLevel.gain.value = 0.55;

	input.connect(output);
	input.connect(delay).connect(feedback).connect(delay).connect(wetLevel).connect(output);

	return { input, output };
})();

slapback.output.connect(context.destination);

const fetchAudioData = async (url) => {
	const response = await fetch(url);
	const buffer = await response.arrayBuffer();
	return await context.decodeAudioData(buffer);
};

const sample = await fetchAudioData(`assets/raindrop_placeholder.${extension}`);

const delay = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const startDrop = async () => {
	setTimeout(() => startDrop(), 300);

	await delay(Math.random() * 0.25);

	const source = context.createBufferSource();
	source.buffer = sample;
	// source.detune.value = (Math.random() - 0.5) * 500;
	source.playbackRate.value = notes[Math.floor(Math.random() * notes.length)];

	const gain = context.createGain();
	gain.gain.value = Math.random() ** 0.5 * 0.06; //  0 to  1

	const panner = context.createStereoPanner();
	panner.pan.value = Math.random() * 2 - 1; // -1 to  1

	source.connect(gain).connect(panner).connect(slapback.input);
	source.addEventListener("ended", () => panner.disconnect(slapback.input));
	source.start(0);
};

const firstTap = new Promise((resolve) => {
	document.addEventListener("touchStart", () => resolve());
	document.addEventListener("mousedown", () => resolve());
});

export default async () => {
	await firstTap;

	for (let i = 0; i < 4; i++) {
		setTimeout(() => startDrop(), i * 500);
	}
};
