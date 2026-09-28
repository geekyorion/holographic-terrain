# Holographic Terrain using ThreeJS

A scroll-driven landing page on top of a procedurally generated, holographic terrain.

- Major and mini contour lines are drawn in the fragment shader, each with its own flowing colour
- Scrolling flies the camera between sections, reshapes the terrain and blends the colour palette
- Scrolling faster makes the colours and the terrain rush
- The **Playground** section tweaks elevation, line density, flow speed, glow and palette live
- Add `?debug` or `#debug` to the URL to open the debug panel

## Setup
Download [Node.js](https://nodejs.org/en/download/).
Run this followed commands:

``` bash
# Install dependencies (only for first time)
npm i

# Serve at localhost:8080
npm run dev

# Build for production in the dist/ directory
npm run build
```

### template branch:

for the basic webpack template (updated) is available in a separate branch [`template`](https://github.com/geekyorion/holographic-terrain/tree/template)
