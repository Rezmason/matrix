import peerDepsExternal from "rollup-plugin-peer-deps-external";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import babel from "@rollup/plugin-babel";
import url from "@rollup/plugin-url";
import { visualizer } from "rollup-plugin-visualizer"; // <- size report
import terser from "@rollup/plugin-terser";
import { string } from "rollup-plugin-string";

export default {
  input: "js/Matrix.js",
  external: ["react", "react-dom"], // keep them out of your bundle
  plugins: [
    peerDepsExternal(), // auto-exclude peerDeps
    nodeResolve(), // so Rollup can find deps in node_modules
    string({ include: ["**/*.glsl"] }),
    url({ include: ["**/*.png"], limit: 0 }),
    babel({
      exclude: "node_modules/**", // transpile JSX
      babelHelpers: "bundled",
      presets: ["@babel/preset-react", "@babel/preset-env"],
    }),
    commonjs(), // turn CJS deps into ES
    terser({
      sourceMap: false, // <- suppress .map generation
      format: { comments: false },
    }),
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      includeAssets: true,
    }), // bundle-size treemap
  ],
  output: [
    {
      file: "dist/index.cjs.js",
      format: "cjs",
      exports: "named",
      sourcemap: false,
    },
    // { file: 'dist/index.esm.js', format: 'es' }               // optional ESM build
  ],
};
