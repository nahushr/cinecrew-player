import { createRoot } from 'react-dom/client';
import DemoApp from '../../native-demo/App.js';
import './style.css';

const params = new URLSearchParams(window.location.search);
const isSurfaceHost = params.has('electronSurfaceHost');
const isControlsOverlay = params.has('electronOverlay');

if (isControlsOverlay) {
  document.documentElement.classList.add('cinecrew-electron-overlay');
}

createRoot(document.getElementById('root')).render(
  isSurfaceHost
    ? <div id="cinecrew-electron-vlc-stage" aria-hidden="true" />
    : <DemoApp />,
);
