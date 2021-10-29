const supportedTypes = {
	["i32"]: [1, 1, "i32"],
	["u32"]: [1, 1, "u32"],
	["f32"]: [1, 1, "f32"],

	["atomic<i32>"]: [1, 1, "i32"],
	["vec2<i32>"]: [2, 2, "i32"],
	["vec3<i32>"]: [4, 3, "i32"],
	["vec4<i32>"]: [4, 4, "i32"],

	["atomic<u32>"]: [1, 1, "u32"],
	["vec2<u32>"]: [2, 2, "u32"],
	["vec3<u32>"]: [4, 3, "u32"],
	["vec4<u32>"]: [4, 4, "u32"],

	["atomic<f32>"]: [1, 1, "f32"],
	["vec2<f32>"]: [2, 2, "f32"],
	["vec3<f32>"]: [4, 3, "f32"],
	["vec4<f32>"]: [4, 4, "f32"],

	["mat2x2<f32>"]: [2, 4, "f32"],
	["mat3x2<f32>"]: [2, 6, "f32"],
	["mat4x2<f32>"]: [2, 8, "f32"],
	["mat2x3<f32>"]: [4, 8, "f32"],
	["mat3x3<f32>"]: [4, 12, "f32"],
	["mat4x3<f32>"]: [4, 16, "f32"],
	["mat2x4<f32>"]: [4, 8, "f32"],
	["mat3x4<f32>"]: [4, 12, "f32"],
	["mat4x4<f32>"]: [4, 16, "f32"],
};

const computeStructLayout = (types) => {
	const fields = [];
	let byteOffset = 0;
	for (const type of types) {
		if (supportedTypes[type] == null) {
			throw new Error(`Unsupported type: ${type}`);
		}
		const [alignAtByte, sizeInBytes, baseType] = supportedTypes[type];
		byteOffset = Math.ceil(byteOffset / alignAtByte) * alignAtByte;
		fields.push({ baseType, byteOffset });
		byteOffset += sizeInBytes;
	}

	// console.log(types);
	// console.log(fields);

	const size = byteOffset * Float32Array.BYTES_PER_ELEMENT;

	return {
		fields,
		size,
		build: (values, buffer = null) => buildStruct(fields, values, buffer ?? new ArrayBuffer(size)),
	};
};

const buildStruct = (fields, values, buffer) => {
	if (values.length !== fields.length) {
		throw new Error(`This struct contains ${fields.length} values, and you supplied ${values.length}.`);
	}

	const views = {
		i32: new Int32Array(buffer),
		u32: new Uint32Array(buffer),
		f32: new Float32Array(buffer),
	};

	for (let i = 0; i < values.length; i++) {
		const view = views[fields[i].baseType];
		const value = values[i];
		const array = value[Symbol.iterator] == null ? [value] : value;
		view.set(array, fields[i].byteOffset);
	}
	return buffer;
};

export default computeStructLayout;
