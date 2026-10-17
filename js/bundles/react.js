// Matrix component only. Renderers, shaders and textures stay behind dynamic
// imports, so bundlers split them into chunks that load on demand (or ahead
// of time, via preload).
export { Matrix } from "../Matrix";
export { preload } from "../matrixLoader";
