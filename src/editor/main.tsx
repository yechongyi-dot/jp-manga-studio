import React from 'react';
import { createRoot } from 'react-dom/client';
import { EditorPlayer } from './EditorPlayer';

const container = document.getElementById('editorRoot');
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <EditorPlayer />
    </React.StrictMode>
  );
}
