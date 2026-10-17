import { defineConfig } from "vite";

// Like core.config.js, but code-split: each renderer, shader and texture is
// its own chunk, so consumers only download what the active config uses.
export default defineConfig({
	build: {
		outDir: "./dist",
		emptyOutDir: false,
		minify: true,
		// Older consumers (eg. Next 11's webpack + terser) can't parse ES2020+ syntax
		target: "es2019",
		lib: {
			entry: "./js/bundles/react.js",
			name: "digital-rain.react",
			fileName: "digital-rain.react",
			formats: ["es"],
		},
		terserOptions: {
			mangle: false,
		},
		rollupOptions: {
			external: ["react", "react-dom"],
			output: {
				entryFileNames: "digital-rain.react.js",
				chunkFileNames: "chunks/[name]-[hash].js",
			},
		},
	},
});
