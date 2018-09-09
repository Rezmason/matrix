# matrix

[Click here for the result.](https://rezmason.github.io/matrix)

[Click here for the free font (TTF).](https://github.com/Rezmason/matrix/raw/master/Matrix-Code.ttf)

"matrix" is a WebGL implementation of the raining green code seen in _The Matrix Trilogy_. It's currently dependent on [Three.js](https://github.com/mrdoob/three.js), though this may not be permanent.

---
### customization


You can customize the digital rain by putting a '?' at the end of the link above, and then chaining together words, like this:

[https://rezmason.github.io/matrix/?width=100&fallSpeed=-0.1&effect=none](https://rezmason.github.io/matrix/?width=100&fallSpeed=-0.1&effect=none)

Here's a list of customization options:

- **version** - the version of the Matrix to simulate. Can be "paradise", "nightmare" or "1999" (default).
- **width** - the number of columns (and rows) to draw. Default is 80.
- **animationSpeed** - the overall speed of the animation. Can be any number, even negative! Default is 1.0.
- **fallSpeed** - the speed of the rain. Can be any number, even negative! Default is 1.0.
- **cycleSpeed** - the speed that the glyphs change their symbol. Can be any number, even negative! Default is 1.0.
- **effect** - alternatives to the default post-processing effect. Can be "plain", "pride", "customStripes", "none", or "image".
- **colors** - if you set the effect to "customStripes", you can specify the colors of vertical stripes as alternating *R,G,B* numeric values, like so: [https://rezmason.github.io/matrix/?effect=customStripes&colors=1,0,0,1,1,0,0,1,0](https://rezmason.github.io/matrix/?effect=customStripes&colors=1,0,0,1,1,0,0,1,0)
- **url** - if you set the effect to "image", this is how you specify which image to load. It doesn't work with any URL; I suggest grabbing them from Wikipedia: [https://rezmason.github.io/matrix/?effect=image&url=https://upload.wikimedia.org/wikipedia/commons/f/f5/EagleRock.jpg](https://rezmason.github.io/matrix/?effect=image&url=https://upload.wikimedia.org/wikipedia/commons/f/f5/EagleRock.jpg)
---
### technical details

The Matrix glyphs in this project are cleaned up vectors [from an old SWF](https://web.archive.org/web/20070914173039/http://www.atari.com:80/thematrixpathofneo/) archived in 2007.
(Please support the [Internet Archive!](https://archive.org/about/))

The Gothic glyphs in this project are derived from [Dr. jur. Robert Pfeffer's font "Silubur"](http://www.robert-pfeffer.net/gotica/englisch/index.html), which are inspired by the uncial script found in the [Codex Argenteus](https://en.wikipedia.org/wiki/Codex_Argenteus).

The Coptic glyphs in this project are derived from [George Douros's font "Symbola"](http://users.teilar.gr/~g1951d), due to their similarity to the script in [CG II of Nag Hammadi](https://en.wikipedia.org/wiki/Nag_Hammadi_Codex_II).

The glyphs are formatted as a multi-channel distance field (or MSDF) via Victor Chlumsky's [msdfgen](https://github.com/Chlumsky/msdfgen). This format preserves the crisp edges and corners of vector graphics when rendered as textures. Chlumsky's thesis paper, which is in English and is also easy to read, is [available to download here](https://dspace.cvut.cz/handle/10467/62770).

The raindrops themselves are particles [computed on the GPU inside of a texture](https://threejs.org/examples/webgl_gpgpu_water.html), much smaller than the final render. The data sent from the CPU to the GPU every frame is negligible.

The opening titles to _The Matrix Reloaded_ and _The Matrix Revolutions_ are the chief reference for this project; in their most basic depiction, a _fixed grid_ of glowing glyphs adjust their brightness and shape to simulate raindrops falling down a windowpane. While the glyph shapes are random, they cycle through a predetermined shape order before repeating. Whereas other Matrix screensavers focus on reproducing more complicated visual effects, such as representing 3D geometries as collages of code rain, this project focuses on the iconic core concept.
