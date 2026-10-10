# Synced 3D Multiview

A small, responsive Three.js playground that renders one animated object from three synchronized camera perspectives.

## Features

- Three simultaneous camera views: orbit, front, and overhead
- Shared object rotation, so all views stay synchronized
- Motion pause/resume, speed control, and reset
- Responsive layout for desktop and mobile
- Lightweight static site; Three.js is loaded from jsDelivr
- Automated JavaScript checks and headless-browser smoke tests
- CI runs on pushes, pull requests, manual dispatch, and a daily schedule

## Run locally

Python is enough to serve the static files:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. The browser needs internet access to load Three.js from the CDN.

## Test locally

```bash
npm install
npm run check
npx playwright install chromium
npm test
```

## Automation

The GitHub Actions workflow in `.github/workflows/ci.yml` checks JavaScript syntax and opens the app in headless Chromium to verify all three views render and the controls work. It runs on every push and pull request, can be started manually, and runs daily at 07:23 UTC.

Scheduled GitHub Actions can be delayed during busy periods. Keep the daily job as a health check, not a strict uptime guarantee.

## Project structure

- `index.html` — page structure and Three.js CDN
- `style.css` — responsive dark UI
- `main.js` — scene, cameras, shared animation, and controls
- `tests/smoke.mjs` — browser smoke test
- `.github/workflows/ci.yml` — continuous integration and daily health check
