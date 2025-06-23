import fetchLibraries from "./fetchLibraries.js";

export default class Renderer {
	static libraries = fetchLibraries();
	#type;
	#canvas;
	#ready;
	#width = 300;
	#height = 150;
	#fullscreen = false;
	#cache = new Map();
	#destroyed = false;
	#running = false;

	constructor(type, ready) {
		this.#type = type;
		this.#canvas = document.createElement("canvas");
		this.#ready = Renderer.libraries
			.then((libraries) => {
				this.#cache = new Map(libraries.staticAssets);
			})
			.then(ready);
		this.#ready.then(() => this.start());
	}

	get running() {
		return this.#running;
	}

	start() {
		this.#running = true;
		this.update();
	}

	stop() {
		this.#running = false;
	}

	update(now) {
		if (!this.#running) return;
		requestAnimationFrame((now) => this.update(now));
	}

	get canvas() {
		return this.#canvas;
	}

	get cache() {
		return this.#cache;
	}

	get type() {
		return this.#type;
	}

	get ready() {
		return this.#ready;
	}

	get size() {
		return [this.#width, this.#height];
	}

	set size([width, height]) {
		[width, height] = [Math.ceil(width), Math.ceil(height)];
		if (width === this.#width && height === this.#height) return;
		[this.#canvas.width, this.#canvas.height] = [this.#width, this.#height] = [width, height];
	}

	get fullscreen() {
		return this.#fullscreen;
	}

	set fullscreen(value) {
		if (!!value === this.#fullscreen) return;
		if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) return;

		this.#fullscreen = value;
		if (document.fullscreenElement != null) {
			document.exitFullscreen();
		}
		if (this.#fullscreen) {
			if (this.#canvas.webkitRequestFullscreen != null) {
				this.#canvas.webkitRequestFullscreen();
			} else {
				this.#canvas.requestFullscreen();
			}
		}
	}

	async configure(config) {
		await this.ready;
		if (this.destroyed) {
			throw new Error("Cannot configure a destroyed renderer.");
		}
	}

	get destroyed() {
		return this.#destroyed;
	}

	destroy() {
		this.stop();
		this.#destroyed = true;
		this.#cache.clear();
	}
}
