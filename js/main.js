const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
document.addEventListener("touchmove", (e) => e.preventDefault(), {
	passive: false,
});

import { makeFullScreenQuad, makePipeline } from "./utils.js";

import makeRain from "./rainPass.js";
import makeBloomPass from "./bloomPass.js";
import makePalettePass from "./palettePass.js";

const dimensions = { width: 1, height: 1 };

const loadJS = (src) =>
	new Promise((resolve, reject) => {
		const tag = document.createElement("script");
		tag.onload = resolve;
		tag.onerror = reject;
		tag.src = src;
		document.body.appendChild(tag);
	});

const init = async () => {
	await loadJS("lib/regl.js");
	await loadJS("lib/webgl-debug.js");

	const resize = () => {
		const devicePixelRatio = window.devicePixelRatio ?? 1;
		canvas.width = Math.ceil(canvas.clientWidth * devicePixelRatio * 0.75);
		canvas.height = Math.ceil(canvas.clientHeight * devicePixelRatio * 0.75);
	};
	window.onresize = resize;
	if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
		window.ondblclick = () => {
			if (document.fullscreenElement == null) {
				if (canvas.webkitRequestFullscreen != null) {
					canvas.webkitRequestFullscreen();
				} else {
					canvas.requestFullscreen();
				}
			} else {
				document.exitFullscreen();
			}
		};
	}
	resize();

	const extensions = ["OES_texture_half_float", "OES_texture_half_float_linear"];
	// These extensions are also needed, but Safari misreports that they are missing
	const optionalExtensions = ["EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "OES_standard_derivatives"];

	const { makeDebugContext } = WebGLDebugUtils;

	const glConsts = {
		DEPTH_TEST: 0x0B71,
		BLEND: 0x0BE2,
		UNPACK_ALIGNMENT: 0x0CF5,
		TEXTURE_2D: 0x0DE1,
		RGBA: 0x1908,
		LUMINANCE: 0x1909,
		NEAREST: 0x2600,
		LINEAR: 0x2601,
		TEXTURE_MAG_FILTER: 0x2800,
		TEXTURE_MIN_FILTER: 0x2801,
		TEXTURE_WRAP_S: 0x2802,
		TEXTURE_WRAP_T: 0x2803,
		CLAMP_TO_EDGE: 0x812F,
		DEPTH_STENCIL_ATTACHMENT: 0x821A,
		TEXTURE0: 0x84C0,
		DEPTH_STENCIL: 0x84F9,
		RGBA16F_EXT: 0x881A,
		STATIC_DRAW: 0x88E4,
		ACTIVE_UNIFORMS: 0x8B86,
		ACTIVE_ATTRIBUTES: 0x8B89,
		COLOR_ATTACHMENT0: 0x8CE0,
		DEPTH_ATTACHMENT: 0x8D00,
		STENCIL_ATTACHMENT: 0x8D20,
		FRAMEBUFFER: 0x8D40,
		RENDERBUFFER: 0x8D41,
		HALF_FLOAT_OES: 0x8D61,
		UNPACK_FLIP_Y_WEBGL: 0x9240,
		UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241,
		UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243,
		BROWSER_DEFAULT_WEBGL: 0x9244,

		ARRAY_BUFFER: 34962,
		FRAGMENT_SHADER: 35632,
		FRAGMENT_SHADER: 35632,
		VERTEX_SHADER: 35633,
		COMPILE_STATUS: 35713,
		LINK_STATUS: 35714,
		TRIANGLES: 4,
		UNSIGNED_BYTE: 5121,
		FLOAT: 5126,
	};

	for (let i = 1; i < 32; i++) {
		glConsts[`TEXTURE${i}`] = 0x84C0 + i;
	}

	const betterNames = {
		[11]: "defaultFragShader",
		[12]: "defaultVertShader",
		[13]: "defaultProgram",
		[17]: "fullscreen_geometry",
		[18]: "rain_compute_doublebuffer_1_texture", [19]: "rain_compute_doublebuffer_1_framebuffer",
		[20]: "rain_compute_doublebuffer_2_texture", [21]: "rain_compute_doublebuffer_2_framebuffer",
		[22]: "rain_compute_shader",
		[23]: "placeholder_texture",
		[24]: "rain_output_texture", [25]: "rain_output_framebuffer", [26]: "rain_output_renderbuffer",
		[27]: "rain_frag_shader",
		[28]: "rain_vert_shader",
		[29]: "rain_program",
		[47]: "rain_geometry",

		[48]: "bloom_high_pass_pyr_0_texture", [49]: "bloom_high_pass_pyr_0_framebuffer", [50]: "bloom_high_pass_pyr_0_renderbuffer",
		[51]: "bloom_high_pass_pyr_1_texture", [52]: "bloom_high_pass_pyr_1_framebuffer", [53]: "bloom_high_pass_pyr_1_renderbuffer",
		[54]: "bloom_high_pass_pyr_2_texture", [55]: "bloom_high_pass_pyr_2_framebuffer", [56]: "bloom_high_pass_pyr_2_renderbuffer",
		[57]: "bloom_high_pass_pyr_3_texture", [58]: "bloom_high_pass_pyr_3_framebuffer", [59]: "bloom_high_pass_pyr_3_renderbuffer",
		[60]: "bloom_high_pass_pyr_4_texture", [61]: "bloom_high_pass_pyr_4_framebuffer", [62]: "bloom_high_pass_pyr_4_renderbuffer",

		[63]: "bloom_h_blur_pyr_0_texture", [64]: "bloom_h_blur_pyr_0_framebuffer", [65]: "bloom_h_blur_pyr_0_renderbuffer",
		[66]: "bloom_h_blur_pyr_1_texture", [67]: "bloom_h_blur_pyr_1_framebuffer", [68]: "bloom_h_blur_pyr_1_renderbuffer",
		[69]: "bloom_h_blur_pyr_2_texture", [70]: "bloom_h_blur_pyr_2_framebuffer", [71]: "bloom_h_blur_pyr_2_renderbuffer",
		[72]: "bloom_h_blur_pyr_3_texture", [73]: "bloom_h_blur_pyr_3_framebuffer", [74]: "bloom_h_blur_pyr_3_renderbuffer",
		[75]: "bloom_h_blur_pyr_4_texture", [76]: "bloom_h_blur_pyr_4_framebuffer", [77]: "bloom_h_blur_pyr_4_renderbuffer",

		[78]: "bloom_v_blur_pyr_0_texture", [79]: "bloom_v_blur_pyr_0_framebuffer", [80]: "bloom_v_blur_pyr_0_renderbuffer",
		[81]: "bloom_v_blur_pyr_1_texture", [82]: "bloom_v_blur_pyr_1_framebuffer", [83]: "bloom_v_blur_pyr_1_renderbuffer",
		[84]: "bloom_v_blur_pyr_2_texture", [85]: "bloom_v_blur_pyr_2_framebuffer", [86]: "bloom_v_blur_pyr_2_renderbuffer",
		[87]: "bloom_v_blur_pyr_3_texture", [88]: "bloom_v_blur_pyr_3_framebuffer", [89]: "bloom_v_blur_pyr_3_renderbuffer",
		[90]: "bloom_v_blur_pyr_4_texture", [91]: "bloom_v_blur_pyr_4_framebuffer", [92]: "bloom_v_blur_pyr_4_renderbuffer",

		[93]: "bloom_output_texture", [94]: "bloom_output_framebuffer", [95]: "bloom_output_renderbuffer",
		[96]: "bloom_high_pass_shader",
		[97]: "bloom_blur_shader",
		[98]: "bloom_combine_shader",
		[99]: "palette_output_texture", [100]: "palette_output_framebuffer", [101]: "palette_output_renderbuffer",
		[102]: "palette_texture",
		[103]: "palette_shader",
		[104]: "msdf_texture",
		[105]: "rain_compute_program",
		[125]: "bloom_high_pass_program",
		[131]: "bloom_blur_program",
		[141]: "bloom_combine_program",
		[155]: "palette_program",
	};

	const returnedValueNames = [];

	const glConstsByID = {};
	Object.entries(glConsts).forEach(([key, value]) => {
		if (glConstsByID[value] == null) {
			glConstsByID[value] = [];
		}
		glConstsByID[value].push(key);
	});

	const returnedValues = [];
	const returnedValueUsages = [];
	const commands = [];

	const log = [];

	const printCommands = (label) => {
		const printedCommands = [];
		for (const {name, args, retIndex} of commands) {
			const printedArgs = [];
			for (const [type, value] of args) {
				if (value == null) {
					printedArgs.push(`null`);
					continue;
				}
				if (Array.isArray(value) || ArrayBuffer.isView(value)) {
					printedArgs.push(`[${value.join(", ")}]`);
					continue;
				}
				switch (type) {
					case "string":
						printedArgs.push(`\`${value}\``);
						break;
					case "GLenum":
						printedArgs.push(`gl.${value}`);
						break;
					case "object":
						printedArgs.push(`${value}`);
						break;
					case "returnedValue":
						printedArgs.push(`state.${returnedValueNames[value]}`);
						break;
					default:
						printedArgs.push(`${value}`);
						break;
				}
			}
			if (retIndex != -1 && returnedValueUsages[retIndex] > 0) {
				printedCommands.push(`state.${returnedValueNames[retIndex]} = gl.${name}(${printedArgs.join(", ")});`);
			} else {
				printedCommands.push(`gl.${name}(${printedArgs.join(", ")});`);
			}
		}
		log.push(`// ${label}`);
		log.push(printedCommands.join("\n"));
		commands.length = 0;
	};

	const rawGL = canvas.getContext("webgl");

	const gl = new Proxy(makeDebugContext(
		rawGL,
		null,
		(...a) => {
			const name = a[0];
			const args = Array.from(a[1]);
			const ret = a[2];
			for (let i = 0; i < args.length; i++) {
				let value = args[i];
				let type = typeof value;
				if (type === "number" && glConstsByID[value] != null) {
					type = "GLenum";
					value = glConstsByID[value][0];
				}
				if (returnedValues.includes(value)) {
					type = "returnedValue";
					value = returnedValues.indexOf(value);
					returnedValueUsages[value]++;
				}
				args[i] = [type, value];
			}

			let retIndex = -1;
			if (typeof ret === "object" && !returnedValues.includes(ret)) {
				returnedValues.push(ret);
				returnedValueUsages.push(0);
				retIndex = returnedValues.length - 1;
				let glType = (ret[Symbol.toStringTag] ?? "object").replaceAll("WebGL", "").toLowerCase();
				let retName = glType + "_" + retIndex;
				switch (name) {
					case "getExtension":
						retName = glType;
						break;
				}
				switch (glType) {
					case "texture":
						break;
					case "framebuffer":
						break;
					case "renderbuffer":
						break;
					case "program":
						break;
					case "shader":
						if (args[0][1].toLowerCase().includes("fragment")) {
							retName = "fragment_shader" + "_" + retIndex;
						} else {
							retName = "vertex_shader" + "_" + retIndex;;
						}
						break;
					case "activeinfo":
						retName = returnedValueNames[args[0][1]] + "_a_" + ret.name;
						break;
					case "uniformlocation":
						retName = returnedValueNames[args[0][1]] + "_u_" + args[1][1];
						break;
				}
				if (returnedValueNames.includes(retName)) {
					retName = retName + "_" + retIndex;
				}

				if (betterNames[retIndex] != null) {
					retName = betterNames[retIndex];
				}

				returnedValueNames[retIndex] = retName;
			}

			commands.push({ name, args, retIndex });
		}
	), {
		/*
		get(target, prop, receiver) {
			const ret = Reflect.get(...arguments);
			if (typeof ret !== "function") {
				console.log("GET", prop, ret);
			}
			return ret;
		}
		*/
	});

	const regl = createREGL({ gl, pixelRatio: 1, extensions, optionalExtensions });

	printCommands("INIT");
	returnedValueUsages.fill(0);

	// All this takes place in a full screen quad.
	const fullScreenQuad = makeFullScreenQuad(regl);
	const pipeline = makePipeline({ regl }, [makeRain, makeBloomPass, makePalettePass]);
	const screenUniforms = { tex: pipeline[pipeline.length - 1].outputs.primary };
	const drawToScreen = regl({ uniforms: screenUniforms });
	await Promise.all(pipeline.map((step) => step.ready));

	printCommands("LOAD");

	const render = ({ viewportWidth, viewportHeight }) => {
		const now = regl.now() * 1000;

		if (dimensions.width !== viewportWidth || dimensions.height !== viewportHeight) {
			dimensions.width = viewportWidth;
			dimensions.height = viewportHeight;
			for (const step of pipeline) {
				step.setSize(viewportWidth, viewportHeight);
			}
			printCommands("RESIZE");
		}
		fullScreenQuad(() => {
			for (const step of pipeline) {
				step.execute();
			}
			drawToScreen();
		});
		printCommands("DRAW");
	};

	render({ viewportWidth: 640, viewportHeight: 480 });

	await new Promise(resolve => {
		setTimeout(() => resolve(), 1000)
	});

	render({ viewportWidth: 640, viewportHeight: 480 });

	console.log(log.join("\n"));

	// const tick = regl.frame(render);
};

document.body.onload = () => {
	init();
};
