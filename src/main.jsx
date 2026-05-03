import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ConfigError from './ConfigError.jsx';
import { missingEnvKeys, firebaseInitError } from './firebase.js';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (missingEnvKeys.length > 0 || firebaseInitError) {
  root.render(
    <React.StrictMode>
      <ConfigError missingKeys={missingEnvKeys} error={firebaseInitError} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
