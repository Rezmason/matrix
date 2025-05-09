import { loadImage, loadText, makePassSVG, makePass } from "./utils.js";

// Multiplies the rendered rain and bloom by a loaded in image

const defaultBGURL = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Flammarion_Colored.jpg/917px-Flammarion_Colored.jpg";

export default ({ config }, inputs) => {
	const output = makePassSVG();
	const bgURL = "bgURL" in config ? config.bgURL : defaultBGURL;
	const background = loadImage(bgURL);

	const render = () => {

	};

	return makePass(
		{
			primary: output,
		},
		Promise.all([background.loaded]),
		(w, h) => {
			// output.resize(w, h);
		},
		(shouldRender) => {
			if (shouldRender) {
				render();
			}
		}
	);
};
