import { Platform } from 'react-native';

export const RAW = 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public';

export const SAMPLES = [
  { id: 'hls', label: 'HLS', title: 'Caminandes · HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' },
  { id: 'ts', label: 'MPEG-TS', title: 'Big Buck Bunny · MPEG-TS', url: `${RAW}/big-buck-bunny.ts`, type: 'mpegts' },
  { id: 'mp4', label: 'MP4', title: 'Big Buck Bunny · MP4', url: `${RAW}/big-buck-bunny.mp4`, type: 'mp4' },
  { id: 'mkv', label: 'MKV', title: 'Big Buck Bunny · MKV', url: `${RAW}/big-buck-bunny.mkv`, type: 'matroska' },
  { id: 'mov', label: 'MOV', title: 'Big Buck Bunny · MOV', url: `${RAW}/big-buck-bunny.mov`, type: 'mov' },
  { id: 'm4v', label: 'M4V', title: 'Big Buck Bunny · M4V', url: `${RAW}/big-buck-bunny.m4v`, type: 'mp4' },
  { id: '3gp', label: '3GP', title: 'Big Buck Bunny · 3GP', url: `${RAW}/big-buck-bunny.3gp`, type: '3gpp' },
  { id: 'flv', label: 'FLV', title: 'Ocean · FLV', url: `${RAW}/sample_960x400_ocean_with_audio.flv`, type: 'flv' },
  { id: 'ogv', label: 'OGV', title: 'Echo · OGV', url: `${RAW}/echo-hereweare.ogv`, type: 'ogg' },
  { id: 'webm', label: 'WebM', title: 'Ocean · WebM', url: `${RAW}/sample_960x400_ocean_with_audio.webm`, type: 'webm' },
];

export const THEME = {
  accentColor: '#16c7d9',
  backgroundColor: '#07111e',
  controlBackground: '#14253a',
  controlColor: '#f8fbff',
  surfaceColor: '#102033',
  borderRadius: 16,
};

export const ALL_CONTROLS = {
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
  diagnostics: true,
};

export const nativePath = (uri) => decodeURIComponent(String(uri).replace(/^file:\/\//, ''));
export const isAndroid = () => Platform.OS === 'android';
