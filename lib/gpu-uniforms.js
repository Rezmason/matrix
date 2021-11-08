/** PLAN
 *
 * Note: This should go in its own repo
 *
 * Address every TODO item
 *
 * https://gpuweb.github.io/gpuweb/wgsl/#alignment-and-size
 * https://gpuweb.github.io/gpuweb/wgsl/#structure-layout-rules
 *
 * Create tests (maybe mocha?)
 *
 * Document
 *  - examples of the simple constructor and from WGSL
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
	["vec2<i32>"]: [2, 2, "i32", array(2)],
	["vec3<i32>"]: [4, 3, "i32", array(3)],
	["vec4<i32>"]: [4, 4, "i32", array(4)],

	["atomic<u32>"]: [1, 1, "u32", zero],
	["vec2<u32>"]: [2, 2, "u32", array(2)],
	["vec3<u32>"]: [4, 3, "u32", array(3)],
	["vec4<u32>"]: [4, 4, "u32", array(4)],

	["atomic<f32>"]: [1, 1, "f32", zero],
	["vec2<f32>"]: [2, 2, "f32", array(2)],
	["vec3<f32>"]: [4, 3, "f32", array(3)],
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
		const [alignAtByte, sizeInBytes, baseType, defaultValue] = simpleTypes[type];
		return {
			baseType,
			alignAtByte,
			sizeInBytes,
			defaultValue,
		};
	} else if (type in otherStructLayouts) {
		const innerLayout = otherStructLayouts[type];
		const { alignAtByte, sizeInBytes } = innerLayout;
		return {
			isStruct: true,
			innerLayout,
			sizeInBytes,
			alignAtByte,
			defaultValue: () => makeDataForLayout(otherStructLayouts, innerLayout),
		};
	} else if (type.startsWith("array<")) {
		const arrayMatch = type.match(/array<(.*?)(, )?(\d+)?>$/);
		const [_, innerType, __, fixedSize] = arrayMatch;
		if (innerType == null) {
			return null;
		}
		const innerTypeData = getTypeData(innerType, [], otherStructLayouts);

		const mult = parseInt(fixedSize ?? "0");
		const alignAtByte = 1; // TODO: calculate based on align rule of arrays
		const sizeInBytes = 1; // TODO: calculate based on size rule of arrays
		// TODO: support stride attribute
		return {
			isArray: true,
			isFixedSize: mult > 0,
			innerTypeData,
			mult,
			sizeInBytes,
			alignAtByte,
			defaultValue: () =>
				Array(mult)
					.fill()
					.map((_) => innerTypeData.defaultValue()),
		};
	} else {
		console.warn(`Unsupported type: ${type}`);
		return null;
	}
};

const parseAttributes = (str) => {
	const attributes = [];
	for (const attr of str.split(",").filter((attr) => attr.length > 0)) {
		const match = attr.match(/(\w+)(\((.*)\))?/); // foo(bar)
		const [_, name, __, value] = match;
		attributes.push({ name, value });
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

		byteOffset = Math.ceil(byteOffset / typeData.alignAtByte) * typeData.alignAtByte;
		// TODO: support align and size attributes
		fields.push({
			attributes: parseAttributes(leftAttributes ?? ""),
			identifier,
			type,
			...typeData,
			byteOffset,
		});
		byteOffset += typeData.sizeInBytes;
	}

	const minSizeInBytes = byteOffset * BYTES_PER_ELEMENT;
	const sizeInBytes = minSizeInBytes; // TODO: support runtime-sized arrays
	const alignAtByte = 1; // TODO: calculate based on align rule of structs
	return { name, fields, sizeInBytes, alignAtByte };
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

const writeField = (allLayouts, field, value, views, byteOffset) => {
	if (field.isArray) {
		const count = field.isFixedSize ? field.mult : value.length;
		for (let i = 0; i < field.mult; i++) {
			writeField(allLayouts, field.innerTypeData, value[i], views, byteOffset + field.innerTypeData.byteOffset * i);
		}
	} else if (field.isStruct) {
		for (const innerField of field.innerLayout.fields) {
			writeField(allLayouts, innerField, value[innerField.identifier], views, byteOffset + field.byteOffset);
		}
	} else {
		const view = views[field.baseType];
		const array = value[Symbol.iterator] == null ? [Number(value)] : value;
		view.set(array, byteOffset + field.byteOffset);
	}
};

export default class Uniforms {
	static fromWGSL(wgsl) {
		const structLayouts = parseStructLayoutsFromShader(wgsl);
		return Object.fromEntries(Object.entries(structLayouts).map(([name, layout]) => [name, new Uniforms(layout, structLayouts)]));
	}

	#structLayouts;
	#layout;
	data;
	minSize;

	constructor(layout, structLayouts = null) {
		if (typeof layout === "string") {
			structLayouts = parseStructLayoutsFromShader(layout);
			layout = Object.values(structLayouts)[0];
		}

		structLayouts ??= {};
		this.#structLayouts = structLayouts;
		this.#layout = layout;
		this.minSize = layout.sizeInBytes;
	}

	object() {
		return makeDataForLayout(this.#structLayouts, this.#layout);
	}

	stuff(object, destination) {
		destination ??= new ArrayBuffer(this.#layout.sizeInBytes); // TODO: expand to support runtime-sized arrays, via the length of the array on the data object

		const views = {
			i32: new Int32Array(destination),
			u32: new Uint32Array(destination),
			f32: new Float32Array(destination),
		};

		for (const field of this.#layout.fields) {
			writeField(this.#structLayouts, field, object[field.identifier], views, 0);
		}

		return destination;
	}
}
