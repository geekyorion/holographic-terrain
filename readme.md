# Holographic Terrain

**Live demo: https://geekyorion.github.io/holographic-terrain/**

A scroll-driven landing page on top of a real-time, procedurally generated terrain, drawn entirely with glowing contour lines. Built with [Three.js](https://threejs.org/) and custom GLSL shaders.

## Features

- **Chromatic contour lines**: major lines carry a flowing colour gradient, and the mini lines between them each get their own hue plus light pulses travelling along them
- **Procedural terrain**: two octaves of Perlin noise displace a plane on the GPU; the landscape drifts towards the camera and fades into fog
- **Scroll-driven scene**: each section has its own camera angle, terrain height and palette, and scrolling blends smoothly between them
- **Scroll velocity**: scroll faster and the colours and terrain rush with you
- **Playground**: live sliders for elevation, line density, mini lines per band, colour flow speed, glow and palette
- **Landing page UX**: sticky nav with active section, section dots, scroll progress bar, reveal-on-scroll content, pointer parallax, responsive down to phone widths
- **Accessible**: keyboard focus styles, skip link, and reduced motion support (`prefers-reduced-motion`)

## How it works

| Step | Where | What |
| --- | --- | --- |
| Displace | `src/shaders/terrain/vertex.glsl` | Perlin noise lifts the plane, a centre valley keeps the text readable |
| Contour | `src/shaders/terrain/fragment.glsl` | Elevation is sliced into bands; `fwidth` draws anti-aliased lines at a constant pixel width |
| Colour | `src/shaders/terrain/fragment.glsl` | A cosine palette offset by position, time and line index keeps every line flowing |
| Scroll | `src/index.js` | Section keyframes (camera, elevation, valley, palette) are eased towards the current scroll position |

## Performance

- Fewer terrain vertices on phones and tablets (320² vs 512² segments)
- Pixel ratio is capped (1.5 on phones, 2 on desktop) and **drops automatically** when frames get slow, then recovers
- Hardware MSAA is skipped on high density screens since the shader already anti-aliases the lines
- The debug panel library is lazy loaded, so it is not part of the main bundle
- No live `backdrop-filter` blur over the animated canvas except the nav bar

## Setup

Install [Node.js](https://nodejs.org/en/download/) (v18+), then:

```bash
# Install dependencies (only for first time)
npm i

# Serve at localhost:8080
npm run dev

# Build for production in the dist/ directory
npm run build
```

### Debug panel

Add `?debug` or `#debug` to the URL to open a [guify](https://github.com/colejd/guify) panel with wireframe, line thickness and fog controls.

## Deployment

Every push to `master` builds the site and deploys `dist/` to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It can also be run manually from the **Actions** tab.

One-time setup: in the repository **Settings → Pages**, set **Source** to **GitHub Actions**.

## Template branch

The basic webpack template is available in a separate branch: [`template`](https://github.com/geekyorion/holographic-terrain/tree/template).

## License

[MIT](LICENSE)
