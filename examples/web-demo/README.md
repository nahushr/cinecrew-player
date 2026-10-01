# React + Vite demo

React DOM playground for the CineCrew Player web entry point. It demonstrates sample streams, URL and local-file input, player controls, chat/EPG drawers, diagnostics, recording, and action callbacks.

## Install and run

Requirements: Git, Node.js LTS, and npm.

```bash
git clone https://github.com/nahushr/cinecrew-player.git
cd cinecrew-player/examples/web-demo
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Build and preview the production bundle with:

```bash
npm run build
npm run preview
```

The manifest tracks `@cinecrew/cinecrew-player` via the `latest` tag. To refresh the installed package to the current npm release, run:

```bash
npm run update:player
```

## Code map

- `src/App.jsx` — demo state, source selection, file input, and callbacks.
- `src/components/PlayerViewport.jsx` — player configuration and feature props.
- `src/components/SourceControls.jsx` — sample, URL, file, inline, and drawer controls.
- `src/samples.js` — sample URLs, media types, and controls.
- `src/hooks/` — chat/EPG integrations and player action handlers.
- `src/style.css` — page styling; player styling comes from the package stylesheet.

## Samples and browser notes

Includes HLS, DASH, MP4, WebM, MKV, MPEG-TS, FLV, OGV, MOV, M4V, and 3GP. Codec support depends on the browser/OS. Remote hosts must allow browser access through CORS; this demo does not proxy streams. Local file selection is independent of URL loading.
