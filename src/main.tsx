import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { analytics } from './firebase';

// Use analytics to ensure it is initialized
console.debug('Firebase Analytics initialized', analytics.app.name);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
