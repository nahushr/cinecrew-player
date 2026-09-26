export const sampleSources = [
  {
    id: 'hls',
    label: 'M3U8',
    title: 'Big Buck Bunny (HLS Stream)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
  },
  {
    id: 'mp4',
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mp4',
    type: 'video/mp4',
  },
  {
    id: 'webm',
    label: 'WebM',
    title: 'Big Buck Bunny 720p (WebM Stream)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Big_buck_bunny_720p_5mb.webm',
    type: 'video/webm',
  },
  {
    id: 'mkv',
    label: 'MKV',
    title: 'Big Buck Bunny (MKV Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mkv',
    type: 'video/x-matroska',
  },
  {
    id: 'ts',
    label: 'MPEG-TS',
    title: 'Big Buck Bunny (MPEG-TS Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.ts',
    type: 'mpegts',
    isLive: true,
  },
  {
    id: 'mov',
    label: 'MOV',
    title: 'Big Buck Bunny (QuickTime Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mov',
    type: 'video/quicktime',
  },
  {
    id: 'mp3',
    label: 'MP3',
    title: 'Big Buck Bunny Soundtrack (MP3 Stream)',
    url: 'https://archive.org/download/Big_Buck_Bunny-13302/Jan_Morgenstern_-_01_-_Prelude.mp3',
    type: 'audio/mpeg',
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
