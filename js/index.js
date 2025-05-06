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
	const [numColumns, setNumColumns] = React.useState(10);
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

	return (
		<div>
			<h1>Rain</h1>
			<button onClick={onButtonClick}>Change</button>
			{/* <button onClick={newNum}>change number</button> */}
			<Matrix style={{width: "80vw", height: "45vh"}} version={version} numColumns={numColumns} density={2.0} />
		</div>
	);
};
root.render(<App />);
