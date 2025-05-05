import React from "react";
import { createRoot } from "react-dom/client";
import { Matrix } from "./Matrix";
//import { Matrix } from "react-matrix-rain";

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
	"holoplay",
	"throwback",
	"updated",
	"1999",
	"2003",
	"2021",
];
const App = () => {
	const [version, setVersion] = React.useState(versions[0]);
	// const [number, setNumber] = React.useState(0);
	const onButtonClick = () => {
		setVersion((s) => {
			const newVersion = versions[idx];
			idx = (idx + 1) % versions.length;
			console.log(newVersion);
			return newVersion;
		});
	};
	// const newNum = () => setNumber((n) => n + 1);
	console.log("version", version);
	// console.log("num", number);

	return (
		<div>
			<h1>Rain</h1>
			<button onClick={onButtonClick}>change version</button>
			{/* <button onClick={newNum}>change number</button> */}
			<Matrix version={version} density={7.0} />
		</div>
	);
};
root.render(<App />);
