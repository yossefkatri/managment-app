import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TamaguiProvider } from 'tamagui'
import config from './tamagui.config.js'
import './index.css'
import App from './App.jsx'

// Dev only: open the app with ?debug in the URL to get an on-screen DevTools console (eruda) on the phone
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/eruda@3.4.1/eruda.min.js'
  script.onload = () => window.eruda.init()
  document.head.appendChild(script)
}

const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TamaguiProvider config={config} defaultTheme={prefersDark ? 'dark' : 'light'}>
      <App />
    </TamaguiProvider>
  </StrictMode>,
)
