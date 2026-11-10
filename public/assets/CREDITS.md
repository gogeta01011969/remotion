# Earth texture

`earth.jpg` is the NASA Blue Marble-derived, cloudless Earth map distributed by the WebGL Earth project as `2_no_clouds_4k.jpg`.

- Asset mirror: https://github.com/turban/webgl-earth/blob/master/images/2_no_clouds_4k.jpg
- Original imagery program: NASA Visible Earth / Blue Marble, https://visibleearth.nasa.gov/collection/1484/blue-marble

Bundled locally; rendering does not fetch the image from the network. The Earth map is a surface texture for a programmatically projected sphere. The city, waves, particles, orbital paths, shapes, and sound bed are generated in code.

# Comparison sphere maps

`moon.jpg`: NASA Scientific Visualization Studio, **CGI Moon Kit**, Ernie Wright / NASA Goddard / LROC, https://svs.gsfc.nasa.gov/4720/. Original download: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg. This map is assembled from Lunar Reconnaissance Orbiter data; it is an aesthetic rendering map, not a substitute for the underlying science data.

The following maps are by **Solar System Scope / INOVE**, https://www.solarsystemscope.com/textures/, distributed under **Creative Commons Attribution 4.0 International**, https://creativecommons.org/licenses/by/4.0/:

- `mercury.jpg`: https://www.solarsystemscope.com/textures/download/2k_mercury.jpg
- `mars.jpg`: https://www.solarsystemscope.com/textures/download/2k_mars.jpg
- `venus_atmosphere.jpg`: https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg (cloud-covered atmosphere, not surface)
- `jupiter.jpg`: https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg
- `neptune.jpg`: https://www.solarsystemscope.com/textures/download/2k_neptune.jpg
- `sun.jpg`: https://www.solarsystemscope.com/textures/download/2k_sun.jpg
- `earth-clouds.jpg`: https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg

Files are bundled without modification. Rendering projects, rotates, lights and optionally blends the maps. Attribution is added to the comparison video's generated YouTube description. These are illustrative surface/atmosphere maps; colors, clouds and solar features are not a live observation. Solar System Scope notes saturation adjustments and reconstructed gaps in some maps. The Sun is rendered as emissive rather than with a planet-like day/night shadow.


# Devanagari font

`fonts/NotoSansDevanagari-Regular.ttf` is Noto Sans Devanagari, bundled for consistent local rendering of the Om glyph (U+0950). It was copied from the installed Noto font. The Noto Project distributes this family under the SIL Open Font License; see the bundled `fonts/OFL-NotoSansDevanagari.txt` and https://github.com/notofonts/devanagari. Rendering waits for this local font and requires no font CDN.


# Procedural object materials

Sports-ball surfaces are generated locally by this project's `object-materials.ts`, with no external product images or generation service. The shared sphere projector wraps deterministic material maps around the object, with diffuse lighting and roughness-dependent highlights. Tennis uses a curved seam and felt-like grain; cricket uses leather-like grain, a central seam and stitch rows; football panels are constructed from a truncated icosahedron (12 pentagons and 20 hexagons). Golf uses spherical dimples with a height channel for local relief lighting. Baseball and softball use red stitches along a curved seam on white or yellow covers. Basketball uses orange grain and three great-circle channels forming eight idealized panels. These are reusable idealized material models, not photographic scans or exact replicas of branded equipment. No additional third-party visual license is needed for those generated materials.
