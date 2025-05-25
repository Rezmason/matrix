import React, { useState } from "react";
import { unmountComponentAtNode } from "react-dom";
import { createRoot } from "react-dom/client";

const urlParams = new URLSearchParams(import.meta.url.replaceAll(/.*?\?/g, ""));
const rootID = urlParams.get("root-id") ?? "root";
const root = createRoot(document.getElementById(rootID));

let componentModule;
switch (urlParams.get("bundle")) {
	case "core": {
		componentModule = (await import("../../dist/digital-rain.core.js"));
		break;
	}
	default: {
		componentModule = (await import("../../js/Matrix"));
	}
}
const { Matrix } = componentModule;

const versions = [
	"classic",
	"3d",
	"resurrections",
	"operator",
	"megacity",
	"nightmare",
	"paradise",
	"trinity",
	"bugs",
	"morpheus",
];
const effects = ["none", "palette", "stripes", "pride", "trans", "image", "mirror"];
const App = () => {
	const [version, setVersion] = useState(versions[0]);
	const [effect, setEffect] = useState("palette");
	const [numColumns, setNumColumns] = useState(80);
	const [resolution, setResolution] = useState(0.75);
	const [cursorColor, setCursorColor] = useState(null);
	const [backgroundColor, setBackgroundColor] = useState("0,0,0");
	const [rendererType, setRendererType] = useState("webgpu");
	const [density, setDensity] = useState(2);
	const [destroyed, setDestroyed] = useState(false);
	const onVersionButtonClick = () => {
		setVersion((s) => {
			let index = versions.indexOf(version) + 1;
			if (index === versions.length) {
				index = 0;
			}
			const newVersion = versions[index];
			console.log("version:", newVersion);
			return newVersion;
		});
		setCursorColor(null);
		setBackgroundColor(null);
	};
	const onEffectButtonClick = () => {
		setEffect((s) => {
			let index = effects.indexOf(effect) + 1;
			if (index === effects.length) {
				index = 0;
			}
			const newEffect = effects[index];
			console.log("effect:", newEffect);
			return newEffect;
		});
		setCursorColor(null);
		setBackgroundColor(null);
	};
	const onRendererButtonClick = () => {
		setRendererType(rendererType === "webgpu" ? "regl" : "webgpu");
	};
	const onDestroyButtonClick = () => {
		setDestroyed(true);
	};

	return (
		<>
			<div>
				<button onClick={onVersionButtonClick}>Version: "{version}"</button>
				<button onClick={onEffectButtonClick}>Effect: "{effect}"</button>
				<button onClick={onRendererButtonClick}>Renderer: {rendererType ?? "default (regl)"}</button>
				<button onClick={onDestroyButtonClick}>Destroy</button>
			</div>
			<div>
				<label htmlFor="cursor-color">Cursor color: </label>
				<input
					name="cursor-color"
					type="color"
					onChange={(e) => {
						const values = e.target.value
							.match(/[\da-fA-F]{2}/g)
							.map((s) => parseInt(s, 16) / 0xff)
							.join(",");
						setCursorColor(values);
					}}
				/>
				<label htmlFor="background-color">Background color: </label>
				<input
					name="background-color"
					type="color"
					onChange={(e) => {
						const values = e.target.value
							.match(/[\da-fA-F]{2}/g)
							.map((s) => parseInt(s, 16) / 0xff)
							.join(",");
						setBackgroundColor(values);
					}}
				/>
			</div>
			<div>
				<label htmlFor="num-columns"># of columns:</label>
				<input
					name="num-columns"
					type="range"
					value={numColumns}
					min="10"
					max="160"
					step="1"
					onInput={(e) => setNumColumns(parseInt(e.target.value))}
				/>
				<label htmlFor="resolution">resolution:</label>
				<input
					name="resolution"
					type="range"
					value={resolution}
					min="0"
					max="1"
					step="0.01"
					onInput={(e) => setResolution(parseFloat(e.target.value))}
				/>
			</div>

			{!destroyed && (
				<Matrix
					style={{ width: "40vw", height: "22vh" }}
					version={version}
					effect={effect}
					numColumns={numColumns}
					resolution={resolution}
					renderer={rendererType}
					cursorColor={cursorColor}
					backgroundColor={backgroundColor}
					density={2.0}
				/>
			)}
		</>
	);
};
root.render(<App />);
