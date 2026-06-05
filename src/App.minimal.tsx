import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = () => {
  return (
    <StrictMode>
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">IzyFlow</h1>
          <p className="text-gray-400">Performance optimized version</p>
        </div>
      </div>
    </StrictMode>
  );
};

export default App;