import React, { useState } from "react";
import { unmountComponentAtNode } from "react-dom";
import { createRoot } from "react-dom/client";
import { Matrix } from "./Matrix";

const root = createRoot(document.getElementById("root"));
let idx = 1;
const versions = [
	"3d",
	"trinity",
	"bugs",
	"megacity",
	"nightmare",
	"paradise",
	"resurrections",
	"operator",
	"throwback",
	"updated",
	"1999",
	"2003",
	"2021",
];
const App = () => {
	const [version, setVersion] = React.useState(versions[0]);
	const [numColumns, setNumColumns] = React.useState(10);
	const [rendererType, setRendererType] = React.useState(null);
	const [destroyed, setDestroyed] = useState(false);
	const onButtonClick = () => {
		setVersion((s) => {
			const newVersion = versions[idx];
			idx = (idx + 1) % versions.length;
			console.log(newVersion);
			return newVersion;
		});
		setNumColumns(() => {
			const newColumns = 10 + Math.floor(Math.random() * 50);
			console.log(newColumns);
			return newColumns;
		});
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
			<button onClick={onButtonClick}>Change properties</button>
			<button onClick={onRendererButtonClick}>Renderer: {rendererType ?? "default (regl)"}</button>
			<button onClick={onDestroyButtonClick}>Destroy</button>
			{!destroyed && (
				<Matrix
					style={{ width: "80vw", height: "45vh" }}
					version={version}
					numColumns={numColumns}
					renderer={rendererType}
					density={2.0}
				/>
			)}
		</div>
	);
};
root.render(<App />);
