import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platform = process.argv[2];
const destination = path.join(demoDir, 'resources/vlc', platform === 'mac' ? 'macos' : 'windows');

if (platform === 'mac') {
  const source = process.env.CINECREW_VLC_DIR || '/Applications/VLC.app/Contents/MacOS';
  if (!fs.existsSync(path.join(source, 'plugins')) || !fs.existsSync(path.join(source, 'lib/libvlc.dylib'))) {
    throw new Error(`VLC 3 runtime with plugins and libvlc.dylib was not found at ${source}`);
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  execFileSync('ditto', [source, destination], { stdio: 'inherit' });
} else if (platform === 'win') {
  if (process.platform !== 'win32') throw new Error('The Windows VLC runtime must be staged on a Windows runner.');
  const source = process.env.CINECREW_VLC_DIR || path.join(process.env.ProgramFiles || 'C:\\Program Files', 'VideoLAN', 'VLC');
  if (!fs.existsSync(path.join(source, 'plugins')) || !fs.existsSync(path.join(source, 'libvlc.dll'))) {
    throw new Error(`VLC runtime with plugins and libvlc.dll was not found at ${source}`);
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
} else {
  throw new Error('Usage: node scripts/stage-vlc.mjs <mac|win>');
}

console.log(`Staged VLC runtime at ${destination}`);
