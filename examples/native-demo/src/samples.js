const raw = 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public';

export const MEDIA_SAMPLES = [
  { id: 'hls', label: 'HLS', title: 'Caminandes · HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' },
  { id: 'ts', label: 'MPEG-TS', title: 'Big Buck Bunny · MPEG-TS', url: `${raw}/big-buck-bunny.ts`, type: 'mpegts' },
  { id: 'mp4', label: 'MP4', title: 'Big Buck Bunny · MP4', url: `${raw}/big-buck-bunny.mp4`, type: 'mp4' },
  { id: 'mkv', label: 'MKV', title: 'Big Buck Bunny · MKV', url: `${raw}/big-buck-bunny.mkv`, type: 'matroska' },
  { id: 'mov', label: 'MOV', title: 'Big Buck Bunny · MOV', url: `${raw}/big-buck-bunny.mov`, type: 'mov' },
  { id: 'm4v', label: 'M4V', title: 'Big Buck Bunny · M4V', url: `${raw}/big-buck-bunny.m4v`, type: 'mp4' },
  { id: '3gp', label: '3GP', title: 'Big Buck Bunny · 3GP', url: `${raw}/big-buck-bunny.3gp`, type: '3gpp' },
  { id: 'flv', label: 'FLV', title: 'Ocean · FLV', url: `${raw}/sample_960x400_ocean_with_audio.flv`, type: 'flv' },
  { id: 'ogv', label: 'OGV', title: 'Echo · OGV', url: `${raw}/echo-hereweare.ogv`, type: 'ogg' },
  { id: 'webm', label: 'WebM', title: 'Ocean · WebM', url: `${raw}/sample_960x400_ocean_with_audio.webm`, type: 'webm' },
];

export function getSourceType(filename = '') {
  const extension = String(filename).split('.').pop()?.toLowerCase();
  return ({ ts: 'mpegts', m3u8: 'm3u8', mkv: 'matroska', flv: 'flv', ogv: 'ogg', ogg: 'ogg', webm: 'webm', mov: 'mov', m4v: 'mp4', '3gp': '3gpp', mp4: 'mp4' })[extension] || undefined;
}
