import { defineConfig } from "vite";

// https://vite.dev/config/
// https://github.com/vitejs/vite/blob/main/docs/guide/build.md
export default defineConfig({
	// assetsInclude: ["assets/**.png", "shaders/**.{wgsl,glsl}"],
	build: {
		outDir: "./dist",
		emptyOutDir: false,
		minify: true,
		// sourcemap: true,
		lib: {
			entry: "./js/bundles/full.js",
			name: "digital-rain.full",
			fileName: 'digital-rain.full',
			formats: ["cjs", "es"],
		},
		terserOptions: {
			mangle: false,
		},
		rollupOptions: {
			external: ["react", "react-dom"],
			output: {
				inlineDynamicImports: true,
				// globals: { react: "React", },
			},
		},
	},
});
