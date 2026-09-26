# CineCrew Player · Native VLC demo

This modular Expo app exercises the React Native player with its bundled VLC engine on Android and iOS. It is separate from the Expo Snack preview because Snack runs in Expo Go, and Expo Go cannot load this package's custom VLC native code.

## Run on a device or emulator

From this directory:

```sh
npm install
npm run android
# or
npm run ios
```

These commands build and install a custom development client containing VLC. Start Metro separately with `npm start` when you need to reload JavaScript. A normal Expo Go launch is not a native VLC test.

The sample picker includes HLS, MPEG-TS, MP4, MKV, MOV, M4V, 3GP, FLV, OGV, and WebM, plus a direct URL field and local-file picker. The remote sample URLs need a network connection. A container's extension alone cannot guarantee playback: the sample also has to use codecs VLC can decode, and the URL/file must be reachable.

## Recording and saving

Start playback first, tap **REC**, then stop from the recording bar. VLC writes the recording into the app cache; the app waits for the file to finish and opens the operating system share sheet. Choose a Files/Downloads destination there. The file is not copied to a public Downloads folder automatically. A successfully saved recording should be non-empty and probe as playable media.

The Snack links in the repository README are useful for checking the shared UI and Expo fallback, but not for validating VLC codecs, native recording, or system file sharing. Use this custom development build for those checks. iOS device/simulator execution additionally requires an available iOS simulator runtime or a connected iPhone and signing setup.
