export const sampleSources = [
  {
    id: 'hls',
    label: 'M3U8',
    title: 'Big Buck Bunny (HLS Stream)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
  },
  {
    id: 'dash',
    label: 'MPEG-DASH',
    title: 'Envivio (MPEG-DASH Stream)',
    url: 'https://dash.akamaized.net/envivio/EnvivioDash3/manifest.mpd',
    type: 'application/dash+xml',
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
    title: 'Ocean (WebM with Audio)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/sample_960x400_ocean_with_audio.webm',
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
    id: 'flv',
    label: 'FLV',
    title: 'Big Buck Bunny (HTTP-FLV Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.flv',
    type: 'video/x-flv',
    isLive: false,
  },
  {
    id: 'ogv',
    label: 'OGV',
    title: 'Echo Here We Are (Ogg Theora Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/echo-hereweare.ogv',
    type: 'video/ogg',
  },
  {
    id: 'mov',
    label: 'MOV',
    title: 'Big Buck Bunny (QuickTime Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.mov',
    type: 'video/quicktime',
  },
  {
    id: 'm4v',
    label: 'M4V',
    title: 'Big Buck Bunny (Apple M4V Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.m4v',
    type: 'video/x-m4v',
  },
  {
    id: '3gp',
    label: '3GP',
    title: 'Big Buck Bunny (3GP Mobile Stream)',
    url: 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/big-buck-bunny.3gp',
    type: 'video/3gpp',
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
    : /\.mpd(?:$|[?#])/.test(`${item.url} ${item.title}`)
      ? 'application/dash+xml'
      : /\.flv(?:$|[?#])/.test(`${item.url} ${item.title}`)
        ? 'video/x-flv'
        : /\.ts(?:$|[?#])/.test(`${item.url} ${item.title}`)
          ? 'mpegts'
          : undefined);

  let uri = item.url;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (item.id !== 'flv' && uri.includes('raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/')) {
      uri = uri.replace('https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public/', '/');
    }
  }

  if (typeof window !== 'undefined' && uri.startsWith('/')) {
    uri = new URL(uri, window.location.href).href;
  }

  return {
    uri,
    title: item.title,
    type: detectedType,
    mediaType: item.isLive ? 'live' : 'movie',
    isLive: Boolean(item.isLive),
  };
}
