import { Matrix } from "./Matrix";
import inclusions from "./inclusions";
import * as reglRenderer from "./regl/main";
import * as webgpuRenderer from "./webgpu/main";
globalThis.inclusions = inclusions;
globalThis.reglRenderer = reglRenderer;
globalThis.webgpuRenderer = webgpuRenderer;
globalThis.Matrix = Matrix;
