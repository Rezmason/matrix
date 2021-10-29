const supportedLayoutTypes = {
	["i32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "i32" },
	["u32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "u32" },
	["f32"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "f32" },

	["atomic<i32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "i32" },
	["vec2<i32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "i32" },
	["vec3<i32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "i32" },
	["vec4<i32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "i32" },

	["atomic<u32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "u32" },
	["vec2<u32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "u32" },
	["vec3<u32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "u32" },
	["vec4<u32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "u32" },

	["atomic<f32>"]: { alignAtByte: 1, sizeInBytes: 1, baseType: "f32" },
	["vec2<f32>"]: { alignAtByte: 2, sizeInBytes: 2, baseType: "f32" },
	["vec3<f32>"]: { alignAtByte: 4, sizeInBytes: 3, baseType: "f32" },
	["vec4<f32>"]: { alignAtByte: 4, sizeInBytes: 4, baseType: "f32" },

	["mat2x2<f32>"]: { alignAtByte: 2, sizeInBytes: 4, baseType: "f32" },
	["mat3x2<f32>"]: { alignAtByte: 2, sizeInBytes: 6, baseType: "f32" },
	["mat4x2<f32>"]: { alignAtByte: 2, sizeInBytes: 8, baseType: "f32" },
	["mat2x3<f32>"]: { alignAtByte: 4, sizeInBytes: 8, baseType: "f32" },
	["mat3x3<f32>"]: { alignAtByte: 4, sizeInBytes: 12, baseType: "f32" },
	["mat4x3<f32>"]: { alignAtByte: 4, sizeInBytes: 16, baseType: "f32" },
	["mat2x4<f32>"]: { alignAtByte: 4, sizeInBytes: 8, baseType: "f32" },
	["mat3x4<f32>"]: { alignAtByte: 4, sizeInBytes: 12, baseType: "f32" },
	["mat4x4<f32>"]: { alignAtByte: 4, sizeInBytes: 16, baseType: "f32" },
};

const computeStructLayout = (types) => {
	const entries = [];
	let byteOffset = 0;
	for (const type of types) {
		if (supportedLayoutTypes[type] == null) {
			throw new Error(`Unsupported type: ${type}`);
		}
		const { alignAtByte, sizeInBytes, baseType } = supportedLayoutTypes[type];
		byteOffset = Math.ceil(byteOffset / alignAtByte) * alignAtByte;
		entries.push({ baseType, byteOffset });
		byteOffset += sizeInBytes;
	}

	// console.log(types);
	// console.log(entries);

	const size = byteOffset * Float32Array.BYTES_PER_ELEMENT;

	return {
		entries,
		size,
		build: (values, buffer = null) => buildStruct(entries, values, buffer ?? new ArrayBuffer(size)),
	};
};

const buildStruct = (entries, values, buffer) => {
	if (values.length !== entries.length) {
		throw new Error(`This struct contains ${entries.length} values, and you supplied ${values.length}.`);
	}

	const views = {
		i32: new Int32Array(buffer),
		u32: new Uint32Array(buffer),
		f32: new Float32Array(buffer),
	};

	for (let i = 0; i < values.length; i++) {
		const view = views[entries[i].baseType];
		const value = values[i];
		const array = value[Symbol.iterator] == null ? [value] : value;
		view.set(array, entries[i].byteOffset);
	}
	return buffer;
};

export default computeStructLayout;
