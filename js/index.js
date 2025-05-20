import React, { useState } from "react";
import { unmountComponentAtNode } from "react-dom";
import { createRoot } from "react-dom/client";
import { Matrix } from "./Matrix";

const root = createRoot(document.getElementById("root"));
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
const effects = ["none", "plain", "palette", "stripes", "pride", "trans", "image", "mirror"];
const App = () => {
	const [version, setVersion] = useState(versions[0]);
	const [effect, setEffect] = useState("plain");
	const [numColumns, setNumColumns] = useState(80);
	const [cursorColor, setCursorColor] = useState(null);
	const [backgroundColor, setBackgroundColor] = useState("0,0,0");
	const [rendererType, setRendererType] = useState(null);
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
		setRendererType(() => (rendererType === "webgpu" ? "regl" : "webgpu"));
	};
	const onDestroyButtonClick = () => {
		setDestroyed(true);
	};

	return (
		<div>
			<h1>Rain</h1>
			<button onClick={onVersionButtonClick}>Version: "{version}"</button>
			<button onClick={onEffectButtonClick}>Effect: "{effect}"</button>
			<button onClick={onRendererButtonClick}>Renderer: {rendererType ?? "default (regl)"}</button>
			<button onClick={onDestroyButtonClick}>Destroy</button>
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
			<label htmlFor="num-columns"># of columns:</label>
			<input
				name="num-columns"
				type="range"
				min="10"
				max="160"
				step="1"
				onInput={(e) => setNumColumns(parseInt(e.target.value))}
			/>

			{!destroyed && (
				<Matrix
					style={{ width: "80vw", height: "45vh" }}
					version={version}
					effect={effect}
					numColumns={numColumns}
					renderer={rendererType}
					cursorColor={cursorColor}
					backgroundColor={backgroundColor}
					density={2.0}
				/>
			)}
		</div>
	);
};
root.render(<App />);
