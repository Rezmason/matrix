export default async () => {
	let glMatrix, createREGL, staticAssets;

	try {
		glMatrix = await import("gl-matrix");
		createREGL = (await import("regl")).default;
		staticAssets = (await import("./staticAssets.js")).default;
	} catch {
		const loadJS = (src) =>
			new Promise((resolve, reject) => {
				const tag = document.createElement("script");
				[tag.onload, tag.onerror, tag.src] = [resolve, reject, src];
				document.body.appendChild(tag);
			});
		await Promise.all([loadJS("lib/regl.min.js"), loadJS("lib/gl-matrix.js")]);
		glMatrix = globalThis.glMatrix;
		createREGL = globalThis.createREGL;
		staticAssets = [];
	}

	return { glMatrix, createREGL, staticAssets };
};
