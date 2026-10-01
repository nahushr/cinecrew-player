# Expo Web demo

React Native Web version of the browser playground, built with Expo and Metro. It uses the package's browser player entry point, not native VLC.

## Install and run

Requirements: Git, Node.js LTS, and npm.

```bash
git clone https://github.com/nahushr/cinecrew-player.git
cd cinecrew-player/examples/expo-web-demo
npm ci
npm run web
```

Open the URL printed by Expo (normally `http://localhost:8081`). Create a static web export with:

```bash
npm run build
```

The manifest tracks `@cinecrew/cinecrew-player` via the `latest` tag. To test the newest npm release without pinning it in the manifest:

```bash
npm install --no-save @cinecrew/cinecrew-player@latest
npm run web
```

If Metro serves an old bundle, restart it with `npx expo start --web --clear`.

## Code map

- `App.js` — responsive page, source/file state, and callbacks.
- `src/components/PlayerViewport.web.js` — web-specific player entry and props.
- `src/components/SourceControls.js` — sample, URL, file, inline, and drawer controls.
- `src/samples.js` — media sample URLs and types.
- `src/hooks/` — chat/EPG integrations and action handlers.
- `metro.config.js` — Expo Web bundler configuration.

## Samples and browser notes

Includes HLS, DASH, MP4, WebM, MKV, MPEG-TS, FLV, OGV, MOV, M4V, and 3GP. Codec support varies by browser/OS, and remote streams need CORS access. Local files are selected in the browser and are not uploaded to a server.
