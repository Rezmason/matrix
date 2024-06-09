import colorToRGB from './colorToRGB.js';

const debounce = function (func, timeout = 1000) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => { func.apply(this, args); }, timeout);
	};
}

const reload = debounce((query) => {
	const target = location.origin + location.pathname + "?" + query;
	console.log("Reloading to ", target);
	location.href = target;
});

window.wallpaperPropertyListener = {
	applyUserProperties: async function(properties) {
		if (properties.wallpaperenginequerystring) {
			reload(properties.wallpaperenginequerystring.value);
		}
	}
};

/* For debug only */

const queryParams = {
	internal: [],
	set: (k, v) => {
		if (!queryParams.internal.map(([k2, _]) => k2).includes(k)) {
			queryParams.internal.push([k, v]);
			return;
		}
		const index = queryParams.internal.findIndex(([k2, _]) => k === k2);
		queryParams.internal[index] = [k, v];
	},
	remove: (...k) => queryParams.internal = queryParams.internal.filter(([k2, _]) => !k.includes(k2)),
	clear: () => queryParams.internal = [],
	toString: () => queryParams.internal.length == 0 ? '' :
		'?' + queryParams.internal.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"),
};

const dumpQueryParamsPerVersion = versions => {
	Object.entries(versions)
		.forEach(([version, value]) => {
			queryParams.clear();
			Object.entries(value)
				.forEach(([key, val]) => {
					if (val === 'null')
						val = null;
					let queryVal;
					switch (key) {
						case "cursorColor":
						case "glintColor":
							queryVal = colorToRGB(val).join(",");
							break;
						case "palette":
							queryVal = val.map(obj => [...colorToRGB(obj.color), obj.at])
								.map(arr => arr.map(element => element.toFixed(2)).join(","))
								.join(",");
							break;
						case "slant":
							queryVal = (val * 180 / Math.PI).toFixed(1);
							break;
						case "width":
							key = "numColumns";	// fall-through
						default:
							queryVal = val;
							break;
					}
					queryParams.set(key, queryVal);
				})
				console.log("###", version)
				console.log(queryParams.toString());
		})
};