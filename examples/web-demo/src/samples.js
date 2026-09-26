export const sampleSources = [
  {
    id: 'hls',
    label: 'M3U8',
    title: 'Mux HLS test stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
  },
  {
    id: 'ts',
    label: 'MPEG-TS',
    title: 'Local MPEG-TS fixture',
    url: '/cinecrew-mpegts-fixture.ts',
    type: 'mpegts',
    isLive: true,
  },
  {
    id: 'mp4',
    label: 'MP4',
    title: 'Local MP4 fixture',
    url: '/cinecrew-mp4-fixture.mp4',
    type: 'video/mp4',
  },
  {
    id: 'mkv',
    label: 'MKV',
    title: 'Local MKV fixture',
    url: '/cinecrew-mkv-fixture.mkv',
    type: 'video/webm',
  },
];

export const allControls = {
  back: true,
  playPause: true,
  seek: true,
  restart: true,
  lock: true,
  mute: true,
  aspectRatio: true,
  audioOnly: true,
  audioTracks: true,
  playbackRate: true,
  fullscreen: true,
  recording: true,
  liveChat: true,
  epg: true,
};

export function asPlayerSource(item) {
  const detectedType = item.type || (/\.m3u8(?:$|[?#])/.test(`${item.url} ${item.title}`)
    ? 'hls'
    : /\.ts(?:$|[?#])/.test(`${item.url} ${item.title}`) ? 'mpegts' : undefined);
  const uri = typeof window !== 'undefined' && item.url.startsWith('/')
    ? new URL(item.url, window.location.href).href
    : item.url;

  return {
    uri,
    title: item.title,
    type: detectedType,
    mediaType: item.isLive ? 'live' : 'movie',
    isLive: Boolean(item.isLive),
  };
}
