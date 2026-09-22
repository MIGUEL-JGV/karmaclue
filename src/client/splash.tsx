// src/client/splash.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import KarmaClueGame from './game'; // Importamos tu juego directamente aquí

function App() {
  // El renderizador monta tu juego KarmaClue al instante eliminando la pantalla en blanco
  return <KarmaClueGame />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
