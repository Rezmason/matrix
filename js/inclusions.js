export default [
	[
		"import::shaders/glsl/bloomPass.highPass.frag.glsl",
		() => import("../shaders/glsl/bloomPass.highPass.frag.glsl"),
	],
	[
		"import::shaders/glsl/bloomPass.blur.frag.glsl",
		() => import("../shaders/glsl/bloomPass.blur.frag.glsl"),
	],
	[
		"import::shaders/glsl/bloomPass.combine.frag.glsl",
		() => import("../shaders/glsl/bloomPass.combine.frag.glsl"),
	],
	["import::shaders/glsl/imagePass.frag.glsl", () => import("../shaders/glsl/imagePass.frag.glsl")],
	[
		"import::shaders/glsl/mirrorPass.frag.glsl",
		() => import("../shaders/glsl/mirrorPass.frag.glsl"),
	],
	[
		"import::shaders/glsl/palettePass.frag.glsl",
		() => import("../shaders/glsl/palettePass.frag.glsl"),
	],
	[
		"import::shaders/glsl/rainPass.intro.frag.glsl",
		() => import("../shaders/glsl/rainPass.intro.frag.glsl"),
	],
	[
		"import::shaders/glsl/rainPass.raindrop.frag.glsl",
		() => import("../shaders/glsl/rainPass.raindrop.frag.glsl"),
	],
	[
		"import::shaders/glsl/rainPass.symbol.frag.glsl",
		() => import("../shaders/glsl/rainPass.symbol.frag.glsl"),
	],
	[
		"import::shaders/glsl/rainPass.effect.frag.glsl",
		() => import("../shaders/glsl/rainPass.effect.frag.glsl"),
	],
	["import::shaders/glsl/rainPass.vert.glsl", () => import("../shaders/glsl/rainPass.vert.glsl")],
	["import::shaders/glsl/rainPass.frag.glsl", () => import("../shaders/glsl/rainPass.frag.glsl")],
	[
		"import::shaders/glsl/stripePass.frag.glsl",
		() => import("../shaders/glsl/stripePass.frag.glsl"),
	],
	["import::assets/coptic_msdf.png", () => import("../assets/coptic_msdf.png")],
	["import::assets/gothic_msdf.png", () => import("../assets/gothic_msdf.png")],
	["import::assets/matrixcode_msdf.png", () => import("../assets/matrixcode_msdf.png")],
	["import::assets/resurrections_msdf.png", () => import("../assets/resurrections_msdf.png")],
	["import::assets/megacity_msdf.png", () => import("../assets/megacity_msdf.png")],
	[
		"import::assets/resurrections_glint_msdf.png",
		() => import("../assets/resurrections_glint_msdf.png"),
	],
	["import::assets/huberfish_a_msdf.png", () => import("../assets/huberfish_a_msdf.png")],
	["import::assets/huberfish_d_msdf.png", () => import("../assets/huberfish_d_msdf.png")],
	[
		"import::assets/gtarg_tenretniolleh_msdf.png",
		() => import("../assets/gtarg_tenretniolleh_msdf.png"),
	],
	["import::assets/gtarg_alientext_msdf.png", () => import("../assets/gtarg_alientext_msdf.png")],
	["import::assets/neomatrixology_msdf.png", () => import("../assets/neomatrixology_msdf.png")],
	["import::assets/sand.png", () => import("../assets/sand.png")],
	["import::assets/pixel_grid.png", () => import("../assets/pixel_grid.png")],
	["import::assets/mesh.png", () => import("../assets/mesh.png")],
	["import::assets/metal.png", () => import("../assets/metal.png")],
	["import::shaders/wgsl/bloomBlur.wgsl", () => import("../shaders/wgsl/bloomBlur.wgsl")],
	["import::shaders/wgsl/bloomCombine.wgsl", () => import("../shaders/wgsl/bloomCombine.wgsl")],
	["import::shaders/wgsl/endPass.wgsl", () => import("../shaders/wgsl/endPass.wgsl")],
	["import::shaders/wgsl/imagePass.wgsl", () => import("../shaders/wgsl/imagePass.wgsl")],
	["import::shaders/wgsl/mirrorPass.wgsl", () => import("../shaders/wgsl/mirrorPass.wgsl")],
	["import::shaders/wgsl/palettePass.wgsl", () => import("../shaders/wgsl/palettePass.wgsl")],
	["import::shaders/wgsl/rainPass.wgsl", () => import("../shaders/wgsl/rainPass.wgsl")],
	["import::shaders/wgsl/stripePass.wgsl", () => import("../shaders/wgsl/stripePass.wgsl")],
];
