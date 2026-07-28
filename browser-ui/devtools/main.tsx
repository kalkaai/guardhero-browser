import { createRoot } from 'react-dom/client';
import DevModePanel from './DevModePanel';

const root = createRoot(document.getElementById('root')!);
root.render(<DevModePanel />);
