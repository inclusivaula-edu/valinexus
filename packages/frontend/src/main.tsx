import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Reset CSS mínimo — sem framework, sem conflitos
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #050c07; color: #e2f0e8; }
  input, button, select, textarea { font-family: inherit; }
  a { color: inherit; }
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap');
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
