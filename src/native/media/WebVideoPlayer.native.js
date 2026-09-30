import React from 'react';

/**
 * Native stub for WebVideoPlayer.
 * Native platforms (Android, iOS) use LibVLC (VLCPlayer) directly and do not
 * load web-only playback hooks or polyfills (mpegts.js, flv.js, dashjs, mediabunny, etc.).
 */
export const WebVideoPlayer = React.forwardRef((_props, _ref) => null);
export default WebVideoPlayer;
