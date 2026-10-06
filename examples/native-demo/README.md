# React Native demo · Android and iOS

Expo app demonstrating the CineCrew Player native interface and VLC-backed playback. It installs the published `@cinecrew/cinecrew-player` npm package at the latest released version. The main-branch release pipeline updates this demo's exact package version and lockfile whenever a new version is published.

## Install and start

Requirements: Git, Node.js LTS, npm, and a configured Android or iOS development environment.

```bash
git clone https://github.com/nahushr/cinecrew-player.git
cd cinecrew-player/examples/native-demo
npm ci
```

Start on Android with an emulator running or a USB-debugging device connected:

```bash
npm run android
```

Start on iOS with macOS, Xcode, and an available simulator/device:

```bash
npm run ios
```

For terminal-only Android SDK/emulator setup and release APK build steps on macOS or Windows, see [INSTALL.md](INSTALL.md#android-emulator-from-terminal). Expo generates or updates native project files as needed; native VLC playback must be tested in an installed Android/iOS app, not a browser.

## Code map

- `App.js` — responsive app shell, source selection, and event handlers.
- `src/components/PlayerViewport.js` — native player props, controls, and error callbacks.
- `src/components/SourceControls.js` — sample, URL/file input, and drawer settings.
- `src/samples.js` — media sample URLs and source metadata.
- `src/hooks/` — chat/EPG integrations and player action callbacks.
- `android/` — Android application project and native build configuration.
- `app.json` — Expo app identifiers and platform settings.

Samples include HLS, DASH, MP4, WebM, MKV, MPEG-TS, FLV, OGV, MOV, M4V, and 3GP. Device codec and network support determine which streams play successfully.
