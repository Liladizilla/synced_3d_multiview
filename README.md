# Synced 3D Multiview

An interactive Three.js sculpture studio with four procedural 3D forms, synchronized camera perspectives, and hands-on geometry controls.

![Synced 3D Studio screenshot, captured from the live preview with the Crystal cluster preset selected](https://cdn.browser-use.com/screenshots/b53c2632-71a5-42ac-9634-beaa7f7b1e62/6.png)

_Screenshot captured from the rendered Vercel preview after selecting Crystal cluster. The browser check confirmed four presets, three camera canvases, and no runtime errors._

**Live demo:** https://synced-3d-multiview.vercel.app/

## Features

- **Four procedural sculpture presets:** polyhedral core, torus knot, crystal cluster, and helix array
- **Three synchronized camera views:** orbit, front, and overhead
- **Compound geometry:** layered meshes, metallic materials, orbital rings, satellites, and wireframe overlays
- **Interactive orbit camera:** drag the primary viewport to inspect the sculpture from different angles
- **Scene controls:** pause/resume motion, adjust rotation speed, switch sculpture presets, toggle wireframe, toggle the floor grid, and reset the scene
- **Live diagnostics:** renderer state, active camera count, and approximate FPS
- **Responsive studio UI:** desktop and mobile layouts, keyboard shortcuts, and reduced-motion preference support
- **Automated validation:** JavaScript syntax checks and Playwright browser smoke tests in GitHub Actions

## Controls

| Control | Action |
| --- | --- |
| Sculpture selector | Switch between four procedural 3D assemblies |
| Drag in Orbit view | Rotate the camera around the scene |
| Rotation speed | Set animation speed from still to 3× |
| Wireframe | Reveal the mesh structure on supported core geometry |
| Grid | Toggle the reference floor grid |
| Pause motion | Freeze or resume the sculpture and its moving parts |
| Reset scene | Restore the default sculpture, speed, camera, and scene toggles |
| `Space` | Pause or resume motion |
| `R` | Reset the scene |

## Run locally

Python is enough to serve the static files:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. The browser needs internet access to load Three.js from jsDelivr. Fonts are loaded from Google Fonts with system-font fallbacks.

## Test locally

```bash
npm install
npm run check
npx playwright install chromium
npm test
```

The browser test verifies that all three camera canvases render, the scene reaches its ready state, motion and speed controls work, sculpture presets switch, and wireframe/grid toggles respond without uncaught page errors.

## Automation

The GitHub Actions workflow in `.github/workflows/ci.yml` checks JavaScript syntax and opens the app in headless Chromium. It runs on pushes and pull requests, can be started manually, and runs daily at 07:23 UTC.

Scheduled GitHub Actions can be delayed during busy periods. Treat the daily job as a periodic health check, not a strict uptime guarantee.

## Project structure

- `index.html` — studio layout, metadata, and Three.js CDN
- `style.css` — responsive dark studio interface and controls
- `main.js` — procedural sculptures, synchronized cameras, animation, and interaction
- `tests/smoke.mjs` — browser smoke tests
- `.github/workflows/ci.yml` — continuous integration and scheduled check
- `docs/screenshots/studio.png` — captured preview of the deployed studio
