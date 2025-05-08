import highPassFrag from "../shaders/glsl/bloomPass.highPass.frag.glsl";
import blurFrag from "../shaders/glsl/bloomPass.blur.frag.glsl";
import combineFrag from "../shaders/glsl/bloomPass.combine.frag.glsl";
import imagePassFrag from "../shaders/glsl/imagePass.frag.glsl";
import mirrorPassFrag from "../shaders/glsl/mirrorPass.frag.glsl";
import palettePassFrag from "../shaders/glsl/palettePass.frag.glsl";
import rainPassIntro from "../shaders/glsl/rainPass.intro.frag.glsl";
import rainPassRaindrop from "../shaders/glsl/rainPass.raindrop.frag.glsl";
import rainPassSymbol from "../shaders/glsl/rainPass.symbol.frag.glsl";
import rainPassEffect from "../shaders/glsl/rainPass.effect.frag.glsl";
import rainPassVert from "../shaders/glsl/rainPass.vert.glsl";
import rainPassFrag from "../shaders/glsl/rainPass.frag.glsl";
import stripePassFrag from "../shaders/glsl/stripePass.frag.glsl";
import msdfCoptic from "../assets/coptic_msdf.png";
import msdfGothic from "../assets/gothic_msdf.png";
import msdfMatrixCode from "../assets/matrixcode_msdf.png";
import msdfRes from "../assets/resurrections_msdf.png";
// import megacity from "../assets/megacity_msdf.png";
import msdfResGlint from "../assets/resurrections_glint_msdf.png";
// import msdfHuberfishA from "../assets/huberfish_a_msdf.png";
// import msdfHuberfishD from "../assets/huberfish_d_msdf.png";
// import msdfGtargTenretni from "../assets/gtarg_tenretniolleh_msdf.png";
// import msdfGtargAlienText from "../assets/gtarg_alientext_msdf.png";
// import msdfNeoMatrixology from "../assets/neomatrixology_msdf.png";
// import texSand from "../assets/sand.png";
// import texPixels from "../assets/pixel_grid.png";
import texMesh from "../assets/mesh.png";
import texMetal from "../assets/metal.png";
import bloomBlurShader from "../shaders/wgsl/bloomBlur.wgsl";
import bloomCombineShader from "../shaders/wgsl/bloomCombine.wgsl";
import endPassShader from "../shaders/wgsl/endPass.wgsl";
import imagePassShader from "../shaders/wgsl/imagePass.wgsl";
import mirrorPassShader from "../shaders/wgsl/mirrorPass.wgsl";
import palettePassShader from "../shaders/wgsl/palettePass.wgsl";
import rainPassShader from "../shaders/wgsl/rainPass.wgsl";
import stripePassShader from "../shaders/wgsl/stripePass.wgsl";

const inclusions = [
	highPassFrag,
	blurFrag,
	combineFrag,
	imagePassFrag,
	mirrorPassFrag,
	palettePassFrag,
	rainPassIntro,
	rainPassRaindrop,
	rainPassSymbol,
	rainPassEffect,
	rainPassVert,
	rainPassFrag,
	stripePassFrag,
	msdfCoptic,
	msdfGothic,
	msdfMatrixCode,
	msdfRes,
	// megacity,
	msdfResGlint,
	// msdfHuberfishA,
	// msdfHuberfishD,
	// msdfGtargTenretni,
	// msdfGtargAlienText,
	// msdfNeoMatrixology,
	// texSand,
	// texPixels,
	texMesh,
	texMetal,
	bloomBlurShader,
	bloomCombineShader,
	endPassShader,
	imagePassShader,
	mirrorPassShader,
	palettePassShader,
	rainPassShader,
	stripePassShader,
].reduce((i, s) => s.length + i, 0);

export default inclusions;
