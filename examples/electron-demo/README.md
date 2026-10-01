# Electron desktop demo

Desktop build with the player UI rendered by React and media rendered by a LibVLC surface. The renderer reuses the native demo screen; Electron's main process owns LibVLC, and a context-isolated preload bridge exposes playback controls.

## Requirements

- Node.js LTS and npm.
- VLC 3 with plugins and LibVLC runtime.
- macOS or 64-bit Windows.

Default VLC locations are `/Applications/VLC.app/Contents/MacOS` on macOS and `C:\Program Files\VideoLAN\VLC` on Windows. Set `CINECREW_VLC_DIR` if it is installed elsewhere.

## Install and run

From a terminal:

```bash
git clone https://github.com/nahushr/cinecrew-player.git
cd cinecrew-player
npm ci --prefix examples/electron-demo
npm run dev --prefix examples/electron-demo
```

The development command builds the renderer with Vite, then opens Electron. To run the already-built renderer:

```bash
npm run build --prefix examples/electron-demo
npm start --prefix examples/electron-demo
```

## Package an installer

Build on the target operating system; the command stages the local VLC runtime into the app before packaging.

macOS DMG:

```bash
npm run dist:mac --prefix examples/electron-demo
open examples/electron-demo/release/cinecrew-player-demo.dmg
```

Windows installer (PowerShell):

```powershell
npm run dist:win --prefix examples/electron-demo
```

Output: `examples/electron-demo/release/cinecrew-player-demo-setup.exe`.

## Code map

- `src/main.jsx` — renderer entry; mounts the shared native-demo app.
- `electron/main.cjs` — windows, LibVLC lifecycle, media events, and IPC handlers.
- `electron/preload.cjs` — allow-listed renderer/main process bridge.
- `vite.config.js` — shared-code aliases and browser-only native-module shims.
- `scripts/stage-vlc.mjs` — stages the platform VLC runtime for installers.
- `package.json` — dev, rebuild, and packaging commands.

Remote streams must be reachable by LibVLC from the desktop. Installer downloads are linked from the repository's [demo table](../../README.md#demos).
