import { createRoot } from 'react-dom/client';
import DemoApp from '../../native-demo/App.js';
import './style.css';

createRoot(document.getElementById('root')).render(
  <DemoApp />,
);
