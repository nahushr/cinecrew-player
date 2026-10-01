# CineCrew Player QA Playbook

This is the contributor and release-candidate standard for the React/Vite, Expo Web, Android, iOS, and Electron demos. Run the applicable cases against the exact build intended for release; attach screenshots or recordings, source identifiers, device/browser versions, and generated-file evidence to every failure.

## 1. Release test rules

- Test a clean app launch and one complete session on each target platform. Do not treat a successful build as proof that playback or controls work.
- Use the sample sources listed below without silently substituting a different file. Record the exact URL and whether the source is remote or local.
- For a format to pass, wait for playback to start, confirm that video frames change, listen for audible program audio, and exercise the seek/play/pause/mute controls. A loading indicator disappearing by itself is not a pass.
- Run the player in both compact inline and full player layouts. For each layout, cover portrait and landscape on mobile; for web and Electron, use a narrow viewport and a wide viewport.
- Repeat source and control tests after changing a source. A previous source’s frame or audio must not remain displayed as if it belonged to the new source.
- Classify an unsupported browser codec as a clear, surfaced playback error—not as a pass. Native LibVLC and browser engines have different codec capabilities; report those separately.
- Recording passes only after the resulting file exists, is non-empty, probes as a media file, and has both expected audio and video streams. An elapsed timer or successful stop toast is insufficient.
- A run with any failed or untested release-critical case is not green. Use `NOT RUN` where the target device, platform, credentials, or external service was unavailable.

## 2. Build and launch

Run from the repository root. Install dependencies with the lockfiles; do not install Sonar, Snyk, Checkstyle, or other cloud quality-gate tools locally.

```sh
npm ci
npm run check:types
npm test
```

### React + Vite

```sh
npm ci --prefix examples/web-demo
npm run dev --prefix examples/web-demo -- --host 0.0.0.0
```

Open the Vite URL printed by the command. For a production bundle:

```sh
npm run build --prefix examples/web-demo
```

### Expo Web

```sh
npm ci --prefix examples/expo-web-demo
npm run web --prefix examples/expo-web-demo
```

Open the URL printed by Expo. Confirm the web-specific player entry point is selected and the browser console has no module-resolution or runtime errors.

### Android / Expo native

Start an Android emulator or connect a device, verify it is listed, then run:

```sh
adb devices
npm ci --prefix examples/native-demo
npm run android --prefix examples/native-demo
```

For a release APK, from the repository root:

```sh
cd examples/native-demo/android
./gradlew assembleRelease
```

Expected artifact: `examples/native-demo/android/app/build/outputs/apk/release/app-release.apk`.

### iOS / Expo native

On macOS with Xcode and an iOS Simulator/device available:

```sh
npm ci --prefix examples/native-demo
npm run ios --prefix examples/native-demo
```

For a simulator archive/build, use the Xcode workspace under `examples/native-demo/ios` and record the selected simulator/runtime and build configuration.

### Electron

```sh
npm ci --prefix examples/electron-demo
npm run start --prefix examples/electron-demo
```

macOS distribution build:

```sh
npm run dist:mac --prefix examples/electron-demo
```

Windows distribution build (run on a supported Windows CI/host):

```powershell
npm ci --prefix examples/electron-demo
npm run dist:win --prefix examples/electron-demo
```

Expected artifacts are `examples/electron-demo/release/cinecrew-player-demo.dmg` and `examples/electron-demo/release/cinecrew-player-demo-setup.exe` respectively. Open the packaged app—not just the development server—and run the functional cases below.

## 3. Source matrix

Use every row available in the demo. For local-file coverage, use a known-good local media file with both audio and video and record its codec/container; do not infer local-file behavior from a remote URL.

| ID | Format | Demo sample | Native / Electron expectation | Web expectation |
| --- | --- | --- | --- | --- |
| HLS | `.m3u8` | `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8` | LibVLC video and audio play | HLS engine plays where browser/CORS permits |
| DASH | `.mpd` | `https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd` | LibVLC video and audio play | DASH engine plays where browser/CORS permits |
| MP4 | `.mp4` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mp4` | LibVLC video and audio play | Browser-supported codecs and CORS required |
| WebM | `.webm` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/sample_960x400_ocean_with_audio.webm` | LibVLC video and audio play | Browser-supported codecs and CORS required |
| Matroska | `.mkv` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mkv` | LibVLC video and audio play | Codec/container support varies by browser |
| MPEG-TS | `.ts` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.ts` | LibVLC video and audio play | TS adapter/patch must play or provide a real surfaced error |
| FLV | `.flv` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/ocean-10s-h264-aac.flv` | LibVLC video and audio play | FLV hook must decode its H.264/AAC sample or surface the actual error |
| OGV | `.ogv` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/echo-hereweare.ogv` | LibVLC video and audio play | OGV hook must decode or surface the actual error |
| MOV | `.mov` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mov` | LibVLC video and audio play | Browser-supported codecs and CORS required |
| M4V | `.m4v` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.m4v` | LibVLC video and audio play | Browser-supported codecs and CORS required |
| 3GP | `.3gp` | `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.3gp` | LibVLC video and audio play | Browser-supported codecs and CORS required |
| Local file | user-selected | Choose a known-good local A/V file | Native document picker URI plays | File input/blob URL plays |

For each applicable source, record: selected source, time-to-first-frame, whether frames move, audible audio, duration/time labels, seek result, playback errors (including `onError` payload), and recording result. If the sample itself has no audio, mark the audio assertion `N/A` with evidence and use a known A/V sample to test audio controls.

## 4. Functional test cases

Perform the cases on every source in the matrix unless a case is explicitly marked once per session. A source-specific failure must remain attached to that format; do not let a working MP4 conceal a broken FLV or TS path.

### A. Playback, state and callbacks

1. Select a source and wait up to 30 seconds for first frame on a normal network. Expect visible changing frames and audible audio when the sample contains audio. If it fails, capture the exact `onError` message and native/browser logs.
2. Tap play/pause twice. Expect playback state and icon to alternate; timestamps stop while paused and continue after resume.
3. Toggle mute and unmute. Expect actual output audio to mute/unmute and the icon/callback state to match.
4. Drag the progress thumb to about 25%, then 70%, and release. Expect seeking to settle at the selected position, labels to update while scrubbing, playback to resume from the released position, and `onProgressBarChange` to report the watched intervals according to its documented contract. A click-only seek is not a drag pass.
5. Restart. Expect the current source to return to its beginning and continue playing; the source must not be changed.
6. Set at least two playback rates (for example 0.5x and 1.5x). Expect the selected rate label and callback to update and playback cadence to change.
7. Test every configured aspect option (Fit, Fill, Stretch, 16:9, 4:3, 1:1, and any caller-supplied ratios). Expect the selected option to be highlighted, the video to remain visible and centered, and no control to escape the video bounds.
8. If brightness control is enabled, move it to a middle value and back. Expect only video pixels to dim/brighten; the device display brightness must not change. Expect `onBrightnessChangeEnd` only after the gesture ends with the final percentage.
9. Toggle audio-only on and off. Expect a dark opaque video-hiding overlay, poster/placeholder, continuing audio, no background video bleed-through, and a working Switch to Video action.
10. Open the audio-track picker. With no supplied tracks, expect the empty state; with supplied tracks, select each and verify the selected state and callback. Do not claim track switching changes the encoded stream unless a source with multiple audio tracks is used.
11. Test lock/unlock. While locked, back and other hidden/disabled controls must not respond; unlock restores the controls.
12. Test back. Expect the caller callback and documented snackbar; navigation is host-defined.

### B. Inline/fullscreen, orientation, bounds and layout

1. Load a source in compact inline mode. Confirm the player occupies the intended card, title is legible, and controls are within the card.
2. Seek to a non-zero position (e.g. 00:30), then enter fullscreen. Expect the same source, playback time, audio/mute state, and aspect ratio to carry across; it must not restart at 00:00.
3. Exit fullscreen and confirm inline playback resumes at the same position.
4. In portrait and landscape, inspect all control rows, brightness/volume rails, title, progress bar, popovers, safe-area edges, and system bars. Expect no overlap, clipping, stray app-background strip, or touch target outside the player.
5. Lock/unlock in fullscreen; confirm the back action is hidden while locked as specified.
6. Rotate while fullscreen and while inline. Expect the player to remain within bounds, the video to remain visible, controls to reflow, and playback time to continue.
7. On web/Electron, repeat with a narrow mobile viewport and desktop viewport. Responsive drawers should become bounded bottom sheets on narrow layouts where specified.

### C. Drawers, chat, EPG and diagnostics

For each drawer (chat, EPG, diagnostics), run each supported layout: `overlay`, `resize`, and `modal`.

1. Open and close the drawer while playback continues. Expect a translucent overlay without shrinking the video in overlay mode; in resize mode expect video and drawer side-by-side when space allows; in modal mode expect a bounded centered/dialog or bottom-sheet presentation per platform.
2. In fullscreen landscape, confirm the drawer is pinned to the top of the video surface and not to an app window behind it. In portrait/narrow layouts, expect a responsive drawer no taller than its documented viewport cap and scrollable content.
3. Chat: verify sample messages, author/time/message alignment, scroll to the top to load the next page automatically, send a message, close the emoji picker with outside click, and verify a new message scrolls the list to the bottom. No “See more” button should appear for lazy loading.
4. EPG: verify current/next program data, timestamps and empty/error states. Confirm close and playback continuity.
5. Diagnostics: verify measured values and their units, a close button, translucent background and colored icons. A metric permanently stuck at “Testing…” or unexplained “unknown” values is a defect to report.

### D. Recording — mandatory per supported platform and media engine

For each format, use a source long enough to record at least 8–10 seconds. Keep a short, reproducible test clip for resume/merge testing.

1. Start recording. Expect a visible REC state and advancing elapsed timer while picture and audio continue.
2. Pause. Expect the timer to freeze and a paused state; confirm playback itself continues unless the platform design explicitly pauses both.
3. Resume. Expect the REC state/timer to resume and output to include media from both sides of the pause.
4. Stop. Expect a completed-file confirmation and an accessible file location.
5. Verify file size is greater than zero and use a media probe/player to confirm decodable video and audio tracks and duration near the total captured time (excluding pause time). Play the saved file.
6. Repeat once without pausing to isolate basic start/stop from segment merge behavior.

Android example evidence commands (adjust package/source paths only when the demo configuration changes):

```sh
adb shell find /sdcard/Movies -type f -iname '*.mp4' -print
adb pull /sdcard/Movies/CineCrew\ Recordings/<recording-file>.mp4 /tmp/cinecrew-recording.mp4
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,codec_type -of json /tmp/cinecrew-recording.mp4
```

Expected: non-zero size, at least one video stream and (for an A/V sample) at least one audio stream; file opens and plays. An app-private saved path is acceptable only if the app can share/export it as promised and QA can inspect the resulting file.

### E. Errors and cleanup

1. Load an intentionally invalid URL. Expect the real engine error to reach `onError` and the host snackbar, with a recoverable player error UI.
2. Load a valid source after an error. Expect playback to recover without restarting the app.
3. Switch sources and close/unmount while playing/recording. Expect the old decoder/recording to stop and no stale callbacks, audio, or frames.
4. Re-run the test after a clean app restart. Confirm no retained lock, drawer, mute, brightness, or recording state leaks across sources unless documented.

## 5. Platform-specific evidence checklist

- **React/Vite and Expo Web:** browser/version, viewport size, source URL, codec/CORS result, console/network errors, audio heard, screenshots/video, and downloaded recording probe.
- **Android:** emulator/device model/API level, app build hash, orientation, source, Logcat excerpt for failures, screen capture, and recording file probe. Validate immersive mode and safe-area/system bars in fullscreen.
- **iOS:** device/simulator model and iOS version, app build hash, source, Xcode device log, screen capture, Files/share-sheet location, and recording probe. Validate orientation and safe-area behavior.
- **Electron:** OS/version/architecture, packaged app version, VLC/runtime version, viewport and display scale, console/log output, recording file location/probe. Test both development and packaged macOS DMG; test Windows EXE on Windows CI/device.

## 6. Required test report format

For each case, report `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`, plus platform/build, source, exact reproduction steps, expected/actual behavior, artifact/log/screenshot path, and owner/follow-up. A release summary may say “green” only when every required target/source/control/recording case is PASS or an explicitly approved platform limitation is recorded; `BLOCKED` and `NOT RUN` are not green.
