import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GeneratorProvider } from './contexts/GeneratorContext';
import { sillyTavernIntegration } from './sillytavern-integration';

try {
  // Initialize SillyTavern integration
  console.log('[Emporium] Initializing...');
  console.log('[Emporium] Running in SillyTavern:', sillyTavernIntegration.isInSillyTavern());

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <GeneratorProvider>
      <App />
    </GeneratorProvider>
  );

  console.log('[Emporium] UI initialized successfully');
} catch (error) {
  console.error('[Emporium] Failed to initialize:', error);

  // Show error on page
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: monospace; color: #d00;">
        <h2>Card Emporium Failed to Initialize</h2>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
        <p>Check the browser console for details.</p>
      </div>
    `;
  }
}
