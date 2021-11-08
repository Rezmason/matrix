/**
 *
 * Meant to conform to the WGSL spec:
 *
 * https://gpuweb.github.io/gpuweb/wgsl/#alignment-and-size
 * https://gpuweb.github.io/gpuweb/wgsl/#structure-layout-rules
 *
 * TODO:
 * - Put in own repo
 * - create mocha tests
 * - Document. Provide examples of the simple constructor and from WGSL
 *
 **/

const BYTES_PER_ELEMENT = 4;
const zero = () => 0;
const array = (n) => () => Array(n).fill(0);

const simpleTypes = {
	["i32"]: [1, 1, "i32", zero],
	["u32"]: [1, 1, "u32", zero],
	["f32"]: [1, 1, "f32", zero],

	["atomic<i32>"]: [1, 1, "i32", zero],
	["atomic<u32>"]: [1, 1, "u32", zero],
	["atomic<f32>"]: [1, 1, "f32", zero],

	["vec2<i32>"]: [2, 2, "i32", array(2)],
	["vec2<u32>"]: [2, 2, "u32", array(2)],
	["vec2<f32>"]: [2, 2, "f32", array(2)],

	["vec3<i32>"]: [4, 3, "i32", array(3)],
	["vec3<u32>"]: [4, 3, "u32", array(3)],
	["vec3<f32>"]: [4, 3, "f32", array(3)],

	["vec4<i32>"]: [4, 4, "i32", array(4)],
	["vec4<u32>"]: [4, 4, "u32", array(4)],
	["vec4<f32>"]: [4, 4, "f32", array(4)],

	["mat2x2<f32>"]: [2, 4, "f32", array(2 * 2)],
	["mat3x2<f32>"]: [2, 6, "f32", array(3 * 2)],
	["mat4x2<f32>"]: [2, 8, "f32", array(4 * 2)],
	["mat2x3<f32>"]: [4, 8, "f32", array(2 * 3)],
	["mat3x3<f32>"]: [4, 12, "f32", array(3 * 3)],
	["mat4x3<f32>"]: [4, 16, "f32", array(4 * 3)],
	["mat2x4<f32>"]: [4, 8, "f32", array(2 * 4)],
	["mat3x4<f32>"]: [4, 12, "f32", array(3 * 4)],
	["mat4x4<f32>"]: [4, 16, "f32", array(4 * 4)],
};

const getTypeData = (type, attributes, otherStructLayouts) => {
	if (simpleTypes[type] != null) {
		let [align, size, baseType, defaultValue] = simpleTypes[type];
		if (attributes.align != null) {
			align = parseInt(attributes.align) / 4;
		}
		if (attributes.size != null) {
			size = parseInt(attributes.size) / 4;
		}
		return {
			baseType,
			align,
			size,
			defaultValue,
		};
	} else if (type in otherStructLayouts) {
		const innerLayout = otherStructLayouts[type];
		let { align, size } = innerLayout;
		if (attributes.align != null) {
			align = parseInt(attributes.align) / 4;
		}
		if (attributes.size != null) {
			size = parseInt(attributes.size) / 4;
		}
		return {
			isStruct: true,
			innerLayout,
			size,
			align,
			defaultValue: () => makeDataForLayout(otherStructLayouts, innerLayout),
		};
	} else if (type.startsWith("array<")) {
		const arrayMatch = type.match(/array<(.*?)(, )?(\d+)?>$/);
		const [_, innerType, __, fixedSize] = arrayMatch;
		if (innerType == null) {
			return null;
		}
		const elementTypeData = getTypeData(innerType, [], otherStructLayouts);

		const mult = parseInt(fixedSize ?? "0");
		const align = elementTypeData.align;
		let stride = elementTypeData.byteOffset;
		if (attributes.stride != null) {
			stride = parseInt(attributes.stride);
		}
		const size = stride * mult;

		return {
			isArray: true,
			isFixedSize: mult > 0,
			elementTypeData,
			mult,
			size,
			align,
			stride,
			defaultValue: () =>
				Array(mult)
					.fill()
					.map((_) => elementTypeData.defaultValue()),
		};
	} else {
		console.warn(`Unrecognized type ${type}.`);
		return null;
	}
};

const parseAttributes = (str) => {
	const attributes = {};
	for (const attr of str.split(",").filter((attr) => attr.length > 0)) {
		const match = attr.match(/(\w+)(\((.*)\))?/); // foo(bar)
		const [_, name, __, value] = match;
		attributes[name] = value;
	}
	return attributes;
};

const parseStruct = (str, structLayouts) => {
	const [_, block, name, body] = str;
	const fields = [];
	let byteOffset = 0;
	const lines = body
		.trim()
		.split(";")
		.filter((s) => s.length > 0);
	for (const line of lines) {
		const fieldMatch = line.match(/(\[\[(.*?)\]\])? ?(\w+) ?: (\[\[(.*?)\]\])? ?(.*)/); // [[...]] foo : [[...]] bar;
		const [_, __, leftAttributes, identifier, ___, rightAttributes, type] = fieldMatch;

		const typeData = getTypeData(type, parseAttributes(rightAttributes ?? ""), structLayouts);
		if (typeData == null) {
			console.warn(`Skipping layout for struct ${name}.`);
			return null;
		}

		byteOffset = Math.ceil(byteOffset / typeData.align) * typeData.align;
		fields.push({
			attributes: parseAttributes(leftAttributes ?? ""),
			identifier,
			type,
			...typeData,
			byteOffset,
		});
		byteOffset += typeData.size;
	}

	const minSizeInBytes = byteOffset * BYTES_PER_ELEMENT;
	const align = Math.max(...fields.map((field) => field.align));
	const size = Math.ceil(minSizeInBytes / align) * align;
	return { name, fields, size, align };
};

const parseStructLayoutsFromShader = (wgsl) => {
	wgsl = wgsl
		.replace(/\/\*(.|\n)*?\*\//gm, "") // remove multi-line comments
		.replace(/\s*\/\/.*$/gm, "") // remove end-of-line comments
		.replace(/\n/gm, "") // remove newlines
		.replace(/:/g, ": ") // add space after colons
		.replace(/\s+/g, " "); // convert all whitespace to single space character

	const structLayouts = {};
	const structMatches = Array.from(wgsl.matchAll(/(\[\[block\]\])? ?struct (\w+) \{(.*?)\};/g)); // [[block]] struct Foo {...}
	for (const struct of structMatches) {
		const layout = parseStruct(struct, structLayouts);
		if (layout != null) {
			structLayouts[layout.name] = layout;
		}
	}
	return structLayouts;
};

const makeDataForLayout = (structLayouts, layout) => Object.fromEntries(layout.fields.map((field) => [field.identifier, field.defaultValue()]));

const writeField = (allLayouts, field, value, views, byteOffset, warnMissingFields) => {
	if (value == null) {
		if (warnMissingFields) {
			console.warn(`Property missing from data: ${field.identifier}`);
		}
		return;
	}
	if (field.isArray) {
		const count = field.isFixedSize ? field.mult : value.length;
		for (let i = 0; i < count; i++) {
			writeField(allLayouts, field.elementTypeData, value[i], views, byteOffset + field.stride * i, warnMissingFields);
		}
	} else if (field.isStruct) {
		for (const innerField of field.innerLayout.fields) {
			writeField(allLayouts, innerField, value[innerField.identifier], views, byteOffset + field.stride * i, warnMissingFields);
		}
	} else {
		const view = views[field.baseType];
		const array = value[Symbol.iterator] == null ? [Number(value)] : value;
		view.set(array, byteOffset + field.byteOffset);
	}
};

const makeGenerator = (layout, structLayouts) => {
	const minSize = layout.size;
	return Object.freeze({
		minSize,
		create: () => makeDataForLayout(structLayouts, layout),
		write: (object, destination, warnMissingFields = false) => {
			if (destination == null) {
				let size = layout.size;
				const lastField = layout.fields[layout.fields.length - 1];
				if (lastField.isArray && lastField.name in object) {
					size += lastField.stride * object[lastField.name].length;
				}
				destination = new ArrayBuffer(size);
			}

			const views = {
				i32: new Int32Array(destination),
				u32: new Uint32Array(destination),
				f32: new Float32Array(destination),
			};

			for (const field of layout.fields) {
				writeField(structLayouts, field, object[field.identifier], views, 0, warnMissingFields);
			}

			return destination;
		},
	});
};

const api = Object.freeze({
	read: (wgsl) => {
		if (typeof wgsl !== "string") {
			throw new Error("Input is not a string.");
		}
		const structLayouts = parseStructLayoutsFromShader(wgsl);
		return Object.fromEntries(Object.entries(structLayouts).map(([name, layout]) => [name, makeGenerator(layout, structLayouts)]));
	},
	byteSizeOf: (simpleType) => simpleTypes[simpleType][1] * BYTES_PER_ELEMENT,
});

export default api;
