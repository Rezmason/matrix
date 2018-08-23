# matrix

[Click here for the result.](https://rezmason.github.io/matrix)

[Click here for the free font (TTF).](https://github.com/Rezmason/matrix/raw/master/Matrix-Code.ttf)

"matrix" is a WebGL implementation of the raining green code seen in _The Matrix Trilogy_. It's currently dependent on [Three.js](https://github.com/mrdoob/three.js), though this may not be permanent.

The glyphs in this project are cleaned up vectors [from an old SWF](https://web.archive.org/web/20070914173039/http://www.atari.com:80/thematrixpathofneo/) archived in 2007.
(Please support the [Internet Archive!](https://archive.org/about/))

The glyphs are formatted as a multi-channel distance field (or MSDF) via Victor Chlumsky's [msdfgen](https://github.com/Chlumsky/msdfgen). This format preserves the crisp edges and corners of vector graphics when rendered as textures. Chlumsky's thesis paper, which is in English and is also easy to read, is [available to download here](https://dspace.cvut.cz/handle/10467/62770).

The opening titles to _The Matrix Reloaded_ and _The Matrix Revolutions_ are the chief reference for this project; in their most basic depiction, a _fixed grid_ of glowing glyphs adjust their brightness and shape to simulate raindrops falling down a windowpane. While the glyph shapes are random, they cycle through a predetermined shape order before repeating. Whereas other Matrix screensavers focus on reproducing more complicated visual effects, such as representing 3D geometries as collages of code rain, this project focuses on the iconic core concept.
