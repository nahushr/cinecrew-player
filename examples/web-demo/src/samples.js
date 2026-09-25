export const sampleSources = [
  {
    id: 'youtube',
    label: 'YouTube',
    title: 'Big Buck Bunny · YouTube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
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
    title: 'Big Buck Bunny · MP4',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  },
  {
    id: 'mkv',
    label: 'MKV',
    title: 'Big Buck Bunny · MKV',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mkv/360/Big_Buck_Bunny_360_10s_1MB.mkv',
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
  videoOnly: true,
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
