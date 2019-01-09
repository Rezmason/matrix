![Matrix screenshot](/screenshot.png?raw=true "Matrix's default appearance.")

# matrix (web-based green code rain, made with love)

### TL;DR

- [Classic Matrix code](https://rezmason.github.io/matrix)
- [Code of the "Nightmare Matrix"](https://rezmason.github.io/matrix?version=nightmare)
  - [(you know, this stuff).](http://matrix.wikia.com/wiki/Nightmare_Matrix)
- [Code of the "Paradise Matrix"](https://rezmason.github.io/matrix?version=paradise)
  - [(AKA this stuff).](http://matrix.wikia.com/wiki/Paradise_Matrix)
- [Pride colors](https://rezmason.github.io/matrix/?effect=pride)
- [Custom stripes (`colors=R,G,B,R,G,B,R,G,B, etc`)](https://rezmason.github.io/matrix/?effect=customStripes&colors=1,0,0,1,1,0,0,1,0)
- [Custom image (`url=www.website.com/picture.jpg`)](https://rezmason.github.io/matrix/?effect=image&url=https://upload.wikimedia.org/wikipedia/commons/f/f5/EagleRock.jpg)
- [Raw compute texture (`effect=none`) (_epilepsy warning_: lots of flickering)](https://rezmason.github.io/matrix/?effect=none)

- [The free font (TrueType).](https://github.com/Rezmason/matrix/raw/master/Matrix-Code.ttf)
---
### about

This project is a WebGL implementation of the raining green code seen in _The Matrix Trilogy_. It's currently dependent on [Three.js](https://github.com/mrdoob/three.js), though this may not be permanent.

---
### goals

The way I see it, there's four kinds of Matrix effects people call ["digital rain"](http://matrix.wikia.com/wiki/Matrix_code):
1. The green symbols that "rain down" operators' screens
2. Scenes from within the simulation that depict green symbols streaking across everything
3. The opening title graphics from *The Matrix*, which combine effect #1 with a "dialing" visualization and some other 3D effects
3. The sequels' opening title graphics, which combine aspects of effects #1 and #2.

While there have been a lot of attempts at #1 and #3, they're all missing important parts of #4 that make digital rain so iconic. Here are the requirements for my implementation:

- **Get the right glyphs**. Like the actual ones. Everyone knows Matrix glyphs are some treatment of [Katakana](https://en.wikipedia.org/wiki/Katakana), but they're also a few characters from [Susan Kare's Chicago typeface](https://en.wikipedia.org/wiki/Chicago_(typeface)). The Matrix glyphs in *this* project come from the source: cleaned up vectors [from an old SWF](https://web.archive.org/web/20070914173039/http://www.atari.com:80/thematrixpathofneo/) for an official Matrix product, archived back in 2007. That's how deep this rabbit hole goes, friends.
(Please support the [Internet Archive!](https://archive.org/about/))
- **Make it look sweet in 2D**. This is not a cop-out. There is just no scene in the movies as iconic as the digital rain itself, and while depth effects are cool, they take away from these other details that make the difference between a goodtrix and a *greatrix*.
- **The glyphs are in a *fixed grid* and *don't move*.** The "raindrops" we see in the 2D effect are changes in the brightness of symbols that occupy a column. To get a closer look at this, try setting the `fallSpeed` to a number close to 0.
- **Get the glow and color right.** Matrix symbols aren't just some shade of phosphorous green; they're first given a bloom effect, and then get tone-mapped to the green color palette.
- **Symbols change shape faster as they dim.** When symbols light up, they almost never change shape, but their cycle speed increases the darker and darker they get.
- **Two "raindrops" can occupy the same column.** This is complicated, because we can't allow them to collide.
- **Capture the glyph sequence.** Yes, the symbols in the sequels' opening titles, which are arguably the highest quality versions of the 2D effect, change according to a repeating sequence (see `glyph order.txt`).
- **Make it free, open source and web based.** Because someone could probably improve on what I've done, and I'd like to see that, and maybe incorporate their improvements back into this project.
- **Whip up some artistic license and depict the *previous* Matrix versions.** The sequels describe [a paradisiacal predecessor](https://rezmason.github.io/matrix?version=paradise) to the Matrix that was too idyllic, [and another earlier, nightmarish Hobbesian version](https://rezmason.github.io/matrix?version=nightmare) that proved too campy. They depict some programs running older, differently colored code, so it's time someone tried rendering them.
- **Include the following statement in the README.md:** Sure, you can enjoy movies, including *The Matrix*, without reading too deeply into them, but if you're going to really think about a film, make it this one. And here's the thing: **The Matrix is a story about transitioning, directed by two siblings who transitioned**. So there! There's plenty more themes in it and its sequels than that, and plenty of room for interpretation, but no room for the misogynistic ideas that led to that gross subreddit we all know about. Wake up from your prejudices, boys. Here's a chance to open our minds, not shut them.

---
### customization

You can customize the digital rain quite a bit by stapling "URL variables" to its URL— by putting a '?' at the end of the link above, and then chaining together words, like this:

[https://rezmason.github.io/matrix/?width=100&fallSpeed=-0.1&effect=none](https://rezmason.github.io/matrix/?width=100&fallSpeed=-0.1&effect=none)

Now you know link fu. Here's a list of customization options:

- **version** - the version of the Matrix to simulate. Can be "paradise", "nightmare" or "1999" (default).
- **width** - the number of columns (and rows) to draw. Default is 80.
- **animationSpeed** - the overall speed of the animation. Can be any number, even negative! Default is 1.0.
- **fallSpeed** - the speed of the rain. Can be any number, even negative! Default is 1.0.
- **cycleSpeed** - the speed that the glyphs change their symbol. Can be any number, even negative! Default is 1.0.
- **effect** - alternatives to the default post-processing effect. Can be "plain", "pride", "customStripes", "none", or "image".
  - ("none" displays the texture whose RGBA values represent the glyph shape and brightness data. _epilepsy warning_: lots of flickering)
- **colors** - if you set the effect to "customStripes", you can specify the colors of vertical stripes as alternating *R,G,B* numeric values, like so: [https://rezmason.github.io/matrix/?effect=customStripes&colors=1,0,0,1,1,0,0,1,0](https://rezmason.github.io/matrix/?effect=customStripes&colors=1,0,0,1,1,0,0,1,0)
- **url** - if you set the effect to "image", this is how you specify which image to load. It doesn't work with any URL; I suggest grabbing them from Wikipedia: [https://rezmason.github.io/matrix/?effect=image&url=https://upload.wikimedia.org/wikipedia/commons/f/f5/EagleRock.jpg](https://rezmason.github.io/matrix/?effect=image&url=https://upload.wikimedia.org/wikipedia/commons/f/f5/EagleRock.jpg)

---
### other details

The Coptic glyphs in the "Paradise Matrix" version are derived from [George Douros's font "Symbola"](http://users.teilar.gr/~g1951d), due to their similarity to the script in [CG II of Nag Hammadi](https://en.wikipedia.org/wiki/Nag_Hammadi_Codex_II). If a 4th century Gnostic scribe trolled Athanasius over IRC, it might look like this.

The Gothic glyphs in the "Nightmare Matrix" version are derived from [Dr. jur. Robert Pfeffer's font "Silubur"](http://www.robert-pfeffer.net/gotica/englisch/index.html), which are inspired by the uncial script found in the [Codex Argenteus](https://en.wikipedia.org/wiki/Codex_Argenteus). If a werewolf emailed a vampire in the 6th century, it might look like this.

The glyphs are formatted as a multi-channel distance field (or MSDF) via Victor Chlumsky's [msdfgen](https://github.com/Chlumsky/msdfgen). This format preserves the crisp edges and corners of vector graphics when rendered as textures. Chlumsky's thesis paper, which is in English and is also easy to read, is [available to download here](https://dspace.cvut.cz/handle/10467/62770).

The raindrops themselves are particles [computed on the GPU inside of a texture](https://threejs.org/examples/webgl_gpgpu_water.html), much smaller than the final render. The data sent from the CPU to the GPU every frame is negligible. That was a fun learning experience.
