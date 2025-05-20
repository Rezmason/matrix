import webpack from "webpack";
import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
	mode: "development",
	entry: path.resolve(__dirname, "./js/index.js"),
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: ["babel-loader"],
			},
			// {
			// 	test: /\.css$/,
			// 	use: ["style-loader", "css-loader"],
			// },
			{
				test: /\.(png|jpe?g|svg|glsl|wgsl)?$/,
				type: "asset/resource",
			},
		],
	},
	resolve: {
		extensions: ["*", ".js", ".jsx"],
	},
	output: {
		path: path.resolve(__dirname, "./dist"),
		filename: "[name].bundle.js",
		clean: true,
	},
	devtool: "inline-source-map",
	plugins: [
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "public/index.html"),
			filename: "index.html",
		}),
		new CopyPlugin({
			patterns: [
				{ from: "assets", to: "assets" },
				{ from: "shaders", to: "shaders" },
			],
		}),
		new webpack.HotModuleReplacementPlugin(),
	],
	devServer: {
		historyApiFallback: true,
		static: path.resolve(__dirname, "./dist"),
		compress: true,
		hot: true,
		open: true,
		port: 3000,
	},
};
