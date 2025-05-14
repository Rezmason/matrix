const svgNS = "http://www.w3.org/2000/svg";
const makePassSVG = () => {
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("xmlns", svgNS);
	return svg;
}

const loadImage = (url) => {
	const image = new Image();
	let loaded = false;
	return {
		image: () => {
			if (!loaded && url != null) {
				console.warn(`image still loading: ${url}`);
			}
			return image;
		},
		width: () => {
			if (!loaded && url != null) {
				console.warn(`image still loading: ${url}`);
			}
			return loaded ? image.width : 1;
		},
		height: () => {
			if (!loaded && url != null) {
				console.warn(`image still loading: ${url}`);
			}
			return loaded ? image.height : 1;
		},
		loaded: (async () => {
			if (url != null) {
				image.crossOrigin = "anonymous";
				image.src = url;
				await image.decode();
				loaded = true;
			}
		})(),
	};
};

const loadText = (url) => {
	let text = "";
	let loaded = false;
	return {
		text: () => {
			if (!loaded) {
				console.warn(`text still loading: ${url}`);
			}
			return text;
		},
		loaded: (async () => {
			if (url != null) {
				text = await (await fetch(url)).text();
				loaded = true;
			}
		})(),
	};
};

const makeLinearGradient = (rgbas) => {
	const data = rgbas.map((rgba) => rgba.map((f) => Math.floor(f * 0xff))).flat();
	return data;
};

const makePass = (outputs, ready, setSize, execute) => ({
	outputs: outputs ?? {},
	ready: ready ?? Promise.resolve(),
	setSize: setSize ?? (() => {}),
	execute: execute ?? (() => {}),
});

const makePipeline = (context, steps) =>
	steps.filter((f) => f != null).reduce((pipeline, f, i) => [...pipeline, f(context, i == 0 ? null : pipeline[i - 1].outputs)], []);

export { loadText, loadImage, makeLinearGradient, makePass, makePassSVG, makePipeline };
