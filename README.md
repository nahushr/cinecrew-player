# CineCrew Player

An embeddable video player for **React** and **React Native** with a shared, customizable control API. Pass local media or a URL using any scheme your platform supports; the player does not rewrite protocols or impose app-specific proxy rules. It supports HLS and MPEG-TS on web, native VLC playback, configurable controls and icons, YouTube embeds, and optional chat, EPG, and recording integrations.

> Direct media sources are passed through to the platform engine. A page/share URL is not necessarily a playable media source; use `resolveSource` to resolve it. The player does not rewrite protocols, proxy media, or impose host-specific CORS rules.

## Install

```sh
npm install cinecrew-player
```

React is the shared peer dependency. Native React Native builds use the VLC adapter plus the `expo-video` fallback; those native modules must be autolinked and compiled into the app binary.

### Supported targets and entry points

The package has one public player API with a renderer selected for the host. The React DOM/Electron entry has no React Native renderer or WebView import; the React Native entry uses native views and native playback adapters.

| Host app | Import | Renderer / playback |
| --- | --- | --- |
| React DOM in a browser | `cinecrew-player` or `cinecrew-player/react` | HTML video, hls.js, patched mpegts.js, and the browser YouTube embed. |
| React DOM inside Electron (macOS `.dmg`, Windows `.exe`) | `cinecrew-player/electron` | Same renderer as React web, using Electron's Chromium media stack. No WebView or custom Electron IPC bridge is needed. |
| React Native Android / iOS | `cinecrew-player` or `cinecrew-player/react-native` | React Native UI with VLC and the Expo video fallback; YouTube uses `react-native-webview`. |
| React Native Web / Expo Web | `cinecrew-player` or `cinecrew-player/react-native-web` | React DOM adapter hosted inside the React Native Web app; uses browser playback engines and does not load native VLC or WebView code. |

Metro selects the React Native entry for native builds; regular React bundlers select the React DOM entry. The explicit subpaths let you pin the renderer when preferred.

### React Native / Expo

```tsx
import CineCrewPlayer from 'cinecrew-player/native';

export function WatchScreen() {
  return (
    <CineCrewPlayer
      source={{ uri: 'https://media.example.com/live/channel.m3u8', isLive: true }}
      title="Example channel"
      controls={{ liveChat: false, epg: false, recording: false }}
    />
  );
}
```

For an Expo prebuild project, add the VLC config plugin and rebuild the native app (a JavaScript reload cannot add a native module). `react-native-webview` is used only as the native YouTube embed surface; regular native streams use VLC / `expo-video`. Browser and Electron YouTube playback use the YouTube IFrame API instead.

```json
{
  "expo": {
    "plugins": ["@cinecrew/react-native-vlc-media-player"]
  }
}
```

Then run `npx expo prebuild` as appropriate for your project and rebuild/install the development or production client. Expo Go does not contain the VLC native module; the player uses its `expo-video` fallback where available. In bare React Native projects, install the native dependencies, run CocoaPods on iOS, and rebuild the app.

The component opens the native player as a full-screen player. To show a compact live preview in a channel list, use the companion component:

```tsx
import { InlineLivePlayer } from 'cinecrew-player/native';

<InlineLivePlayer
  url={channelUrl}
  title="Example channel"
  height={220}
  isActive={selected}
  paused={!selected}
  onFullscreen={() => openFullPlayer(channelUrl)}
/>
```

The web entry exports the same compact preview component:

```tsx
import { InlineLivePlayer } from 'cinecrew-player/web';
import 'cinecrew-player/styles.css';

<InlineLivePlayer
  source={{ uri: channelUrl, isLive: true }}
  title="Example channel"
  isActive={selected}
  paused={!selected}
  onFullscreen={() => openFullPlayer(channelUrl)}
/>
```

### React (web)

```tsx
import CineCrewPlayer from 'cinecrew-player';
import 'cinecrew-player/styles.css';

export function WatchScreen() {
  return (
    <CineCrewPlayer
      source={{ uri: 'https://media.example.com/live/channel.m3u8', isLive: true }}
      title="Example channel"
      autoPlay
      theme={{ accentColor: '#35d7ff', borderRadius: 16 }}
    />
  );
}
```

Web playback is direct from the supplied URL. HLS and MPEG-TS clients fetch playlists/segments from the stream origin, so the origin must permit those browser requests. The package intentionally does not route video bytes through a Cloudflare Worker or another resolver.

### YouTube and share links

Pass a YouTube watch, Shorts, or `youtu.be` URL as the source to play it inside the player rather than opening another app:

```tsx
<CineCrewPlayer source="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Trailer" />
```

The video must allow embedding. Other URLs are passed unchanged to the platform engine. A Google Drive/share page or other webpage is not itself a media stream; resolve it in your app and provide the playable URL, or use the optional `resolveSource` callback. This keeps provider authentication, CORS policy, and URL extraction under the consuming app’s control.

```tsx
<CineCrewPlayer
  source={{ uri: driveShareUrl, title: 'My video' }}
  resolveSource={async (source, { platform }) => ({
    ...source,
    uri: await resolveMyDriveMediaUrl(source.uri, platform),
  })}
/>
```

## Media support

| Platform | Playback path | Notes |
| --- | --- | --- |
| Web | Native `<video>`, hls.js, and the bundled patched mpegts.js client | MP4 and browser-native formats, HLS (`.m3u8`), and MPEG-TS (`.ts`) when the stream, codecs, and CORS policy permit it. |
| React Native Android / iOS | VLC native module; `expo-video` fallback when VLC is unavailable | VLC supports a broader range of containers/codecs, including common AC3 streams. Native module availability depends on the app binary. |
| Electron renderer | Chromium `<video>`, hls.js, and patched mpegts.js | Same browser codec/CORS constraints as React web; packages with the app's `.dmg` / `.exe`. |

Browser codec support varies. The web player reports an AC3 compatibility message only when its MPEG-TS probe identifies unsupported AC3 audio; native playback does not apply this browser-only restriction. YouTube sources use the embedded YouTube player and remain subject to the video’s embed settings.

## Props

`CineCrewPlayer` accepts the following common props. `source` can be a URL string or an object; `url` is a convenience alias.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `string \| PlayerSource` | — | Media URL and optional metadata. `uri` and `url` are accepted. |
| `url` | `string` | — | Alias for `source`. |
| `title` | `string` | `source.title \| ''` | Display title. |
| `poster` / `posterUrl` | `string` | `source.posterUrl` | Poster displayed where supported and in audio-only mode. |
| `mediaType` | `string` | inferred | For example `live`, `movie`, or `series`. |
| `isLive` | `boolean` | `source.isLive \| false` | Marks a live source. |
| `visible` | `boolean` | URL present | Show or hide the native player. |
| `autoPlay` | `boolean` | `true` | Start playback automatically. Browser autoplay policies may still require muted playback or a user gesture. |
| `paused` | `boolean` | `!autoPlay` | Initial paused state; web also observes changes. |
| `muted` | `boolean` | `false` | Initial mute state. |
| `volume` | `number` | `1` | Initial volume from `0` to `1`. |
| `playbackRate` | `number` | `1` | Initial playback speed; the on-demand speed control can change it afterward. |
| `controls` | `PlayerControls` | defaults below | Show/hide individual control buttons. |
| `actions` | `PlayerActions` | `{}` | Replace the built-in behavior for individual actions. If a callback is provided, that callback owns the action. |
| `integrations` | `PlayerIntegrations` | `{}` | Inject user identity, chat, EPG, recording, analytics, and presence services. |
| `theme` | `PlayerTheme` | built-in theme | Customize player colors, borders, and shape. |
| `icons` | `PlayerIcons` | built-in icons | Override any control icon by key. |
| `style` | platform style | — | Outer player style. On web this is a CSS style object; native uses React Native style props. |
| `className` | `string` | `''` | Web-only class name for the player root. |
| `videoOnly` | `boolean` | `false` | Start muted in video-only mode. |
| `audioOnly` | `boolean` | `false` | Start in audio-only presentation. Playback continues while the visual card is shown. |
| `resolveSource` | callback | — | Optional synchronous or asynchronous resolver for share pages and provider-specific links. Receives `{ uri, ...source }` and `{ platform }`; return a playable URL or `PlayerSource`. Without it, the original source is passed through unchanged. |
| `audioTracks` | `AudioTrack[]` | detected | Optional supplied track list (web). Native tracks are read from the native player. |
| `selectedAudioTrack` | `string \| number` | first/default track | Initial or preferred audio track. |
| `resumePosition` | `number` | `0` | Resume position in seconds for on-demand playback. |
| `durationSecs` | `number` | `0` | Known duration in seconds. |
| `mediaId`, `episodeLabel`, `season`, `episode`, `genre`, `categoryName` | metadata | — | Optional item metadata for the player and integrations. |
| `playlist` | `object[]` | — | Episode list used for automatic next-episode behavior. |
| `shuffle` | `boolean` | `false` | Select a random next episode when the current episode ends. |
| `onClose`, `onBack`, `onMinimize` | callbacks | — | Player lifecycle/navigation callbacks. |
| `onReady`, `onProgress`, `onPlaying`, `onBuffering`, `onError`, `onEnded`, `onPlaybackRoute` | callbacks | — | Playback lifecycle callbacks. Progress payloads are platform-specific native/browser events. |
| `onNextEpisode`, `onCwRefresh` | callbacks | — | Episode advancement and post-close refresh hooks. |
| `renderLiveChat`, `renderEpg` | render functions | — | Web custom-panel render slots. On native, use the chat/EPG integration adapters. |
| `initialShowLiveChat`, `liveChatNonce` | `boolean`, `number` | `false`, `0` | Open or re-open the live-chat panel (when available). |
| `inlinePreview`, `inlinePreviewRect`, `onInlinePreviewWheel`, `onPromotePreview`, `onPlayerHostRef` | preview options and callbacks | — | Embed/manage the player as a movable inline preview. Mainly useful for app-level player shells. |

`features` can enable optional diagnostics with `{ diagnostics: true }`. `onFullscreen` receives `{ isFullscreen }`. All lifecycle callbacks in the table are optional; native event objects differ from browser events.

### Player source

```ts
type PlayerSource = string | {
  uri?: string;
  url?: string;
  title?: string;
  poster?: string;
  posterUrl?: string;
  id?: string | number;
  streamId?: string | number;
  mediaId?: string | number;
  type?: string;       // e.g. 'mpegts', 'hls', or 'youtube' when paired with a YouTube video ID
  mimeType?: string;
  mediaType?: string;
  isLive?: boolean;
};
```

### Inline live preview props

`InlineLivePlayer` is exported from `cinecrew-player/native` and `cinecrew-player/web`. It renders a compact channel preview/poster and can promote playback to the host app's full player.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `source`, `url` | `string \| PlayerSource` | — | Direct channel URL and optional channel metadata. |
| `title` | `string` | `Live TV` | Channel title shown in the preview. |
| `height` | `number` | `220` | Inline preview height. |
| `poster`, `posterChannel` | string / object | — | Still image or channel object used when preview is paused/inactive. |
| `paused`, `isActive` | `boolean` | `false`, `true` | Control whether this preview should render/play its stream. |
| `onActivate` | `() => void` | — | Called when an inactive preview poster is selected. |
| `onFullscreen` | `() => void` | — | Called to promote/open the full player. |
| `controls` | `Pick<PlayerControls, 'playPause' \| 'mute' \| 'fullscreen'>` | all shown | Toggle its compact controls. |
| `actions` | matching `PlayerActions` subset | built-in | Replace play/pause, mute, or promote behavior. |
| `initialMuted` | `boolean` | `true` | Initial preview mute state. |
| `theme`, `icons`, `style` | `PlayerTheme`, `PlayerIcons`, platform style | defaults | Customize preview colors, controls, and layout. |
| `onError`, `onPlaying` | callbacks | — | Playback lifecycle callbacks. |

## Control visibility

Every control can be hidden with `false`. Defaults are designed to be useful out of the box; adapter-backed controls appear when their adapter or corresponding action callback is supplied.

```tsx
<CineCrewPlayer
  source={source}
  controls={{
    back: true,
    playPause: true,
    restart: true,
    lock: true,
    mute: true,
    aspectRatio: true,
    videoOnly: false,
    audioOnly: true,
    audioTracks: true,
    playbackRate: true,
    minimize: false,
    fullscreen: true,
    recording: false,
    liveChat: false,
    epg: false,
    seek: true,
  }}
/>
```

| Control key | Description |
| --- | --- |
| `back` | Back/close button. Native hardware back remains available. |
| `playPause` | Center play/pause control. |
| `restart` | Restart on-demand media. |
| `lock` | Lock/unlock touch controls. |
| `mute` | Mute/unmute. |
| `aspectRatio` | Fit/fill/stretch and available aspect choices. |
| `videoOnly` | Mute audio while keeping video visible. |
| `audioOnly` | Show the audio-only card while playback continues. |
| `audioTracks` | Audio-track picker when tracks are exposed. |
| `playbackRate` | On-demand playback speed. |
| `minimize` | Minimize callback button; hidden unless enabled. |
| `fullscreen` | Fullscreen button on web and inline previews. Native player opens full-screen. |
| `recording` | Recording controls; requires `integrations.recording` or an action override. |
| `liveChat` | Chat drawer/panel; requires a chat adapter, render slot, or action override. |
| `epg` | EPG drawer/panel; requires an EPG adapter, render slot, or action override. |
| `seek` | On-demand seek bar. |

## Actions and callbacks

Callbacks passed to `actions` **replace** built-in behavior; this is useful when an app wants to own navigation, playback state, or a control. Each receives an action payload and a context with the imperative `player` API (and the web video element where available).

```tsx
const playerRef = React.useRef(null);

<CineCrewPlayer
  ref={playerRef}
  source={source}
  actions={{
    onRestart: (_payload, { player }) => player?.restart(),
    onMinimize: () => closePlayerSheet(),
    onBack: () => navigation.goBack(),
    onMute: ({ muted }, { player }) => player?.setMuted(muted),
    onAspectRatioChange: ({ aspectRatio }, { player }) => player?.setAspectRatio(aspectRatio),
  }}
/>
```

Available action keys: `onBack`, `onPlayPause`, `onSeek`, `onRestart`, `onLock`, `onMute`, `onAspectRatioChange`, `onVideoOnlyChange`, `onAudioOnlyChange`, `onAudioTrackChange`, `onMinimize`, `onPlaybackRateChange`, `onFullscreen`, `onRecordingStart`, `onRecordingPause`, `onRecordingResume`, `onRecordingStop`, `onLiveChatOpen`, `onEpgOpen`, and `onDiagnosticsOpen`.

The ref exposes `play`, `pause`, `togglePlayPause`, `restart`, `setMuted`, `toggleMute`, `setAspectRatio`, `setAudioTrack`, `setAudioOnly`, `setVideoOnly`, `setPlaybackRate`, `seekTo`, `seekBy`, `back`, `minimize`, `getVideoElement`, `getAudioTracks`, and fullscreen methods where supported.

## Integrations

Integrations are optional. The package has no CineCrew account, database, or worker dependency; the consuming app supplies its own functions.

```tsx
<CineCrewPlayer
  source={source}
  mediaId={channel.id}
  integrations={{
    user: { id: currentUser.id, username: currentUser.name },
    liveChat: {
      pollIntervalMs: 5000,
      loadMessages: ({ channelId, limit }) => api.loadChat(channelId, limit),
      sendMessage: ({ channelId, userId, username, comment }) =>
        api.sendChat({ channelId, userId, username, comment }),
    },
    epg: {
      limit: 48,
      loadListings: ({ channelId, limit }) => api.getEpg(channelId, limit),
    },
    recording: {
      start: ({ getVideoElement, streamUrl, title }) => recorder.start({ getVideoElement, streamUrl, title }),
      pause: () => recorder.pause(),
      resume: () => recorder.resume(),
      stop: () => recorder.stop(),
      isActive: () => recorder.isActive(),
      subscribe: (listener) => recorder.subscribe(listener),
    },
    onEvent: ({ name, payload }) => analytics.track(name, payload),
    onProgress: (progress) => saveProgress(progress),
    onPresence: (presence) => updatePresence(presence),
    onSleepTimerExpired: (close) => sleepTimer.onExpired(close),
  }}
/>
```

`loadMessages` returns an array of messages with `username` and `comment` (or `message`) fields. `loadListings` returns EPG entries with `startMs` and `endMs` epoch-millisecond timestamps. The native player renders the built-in chat and EPG UI from these adapters. On web, an app can use `renderLiveChat` / `renderEpg`, or provide `integrations.liveChat.render` / `integrations.epg.render`.

## Themes and icons

Defaults are used unless the caller supplies an override. Web theme properties include `accentColor`, `backgroundColor`, `controlBackground`, `controlColor`, `surfaceColor`, `errorColor`, and `borderRadius`. Native also accepts a `colors` palette object.

```tsx
<CineCrewPlayer
  source={source}
  theme={{
    accentColor: '#16c7d9',
    backgroundColor: '#07111e',
    surfaceColor: '#101e30',
    controlColor: '#f8fbff',
    borderRadius: 18,
  }}
  icons={{
    play: <MyPlayIcon />,
    pause: <MyPauseIcon />,
    mute: 'volume-mute',
    fullscreen: ({ color, size }) => <MyFullscreenIcon color={color} size={size} />,
  }}
/>
```

Icon keys: `play`, `pause`, `restart`, `lock`, `unlock`, `mute`, `unmute`, `aspectRatio`, `videoOnly`, `audio`, `minimize`, `back`, `recording`, `stop`, `liveChat`, `epg`, `fullscreen`, and `close`. A value may be a string/glyph, a React element, or an icon component.

## Sources and link resolution

Local file URIs and direct stream URLs are passed to the selected platform player without changing `http`, `https`, `file`, or other schemes. YouTube watch/share URLs are recognized and played with the embedded YouTube player. Other sharing pages (for example, a private Google Drive page) need a consumer-provided resolver because the package cannot access the consumer’s credentials or infer every host’s download rules:

```tsx
<CineCrewPlayer
  source={{ uri: driveShareUrl, title: 'My video' }}
  resolveSource={async (source, { platform }) => {
    const playableUrl = await myDriveService.getPlayableUrl(source.uri, platform);
    return { ...source, uri: playableUrl };
  }}
/>
```

The web browser still enforces its own media-format and origin policies. The player reports engine errors through `onError`; the consuming application decides how to resolve or present them.

## License and attribution

The player package is MIT-licensed. The native VLC module is an adapted upstream project and includes its license and notices. MPEG-TS playback uses the bundled patched `mpegts.js` distribution, retaining its Apache-2.0 license. See [`NOTICE`](NOTICE) and the included dependency licenses for details.

## Development

```sh
npm install
npm run check:types
npm test
npm pack --dry-run
```

The repository includes the native VLC module under `packages/react-native-vlc-media-player` because native autolinking and native build files must ship as an installable dependency.
