import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TamaguiProvider } from 'tamagui'
import config from './tamagui.config.js'
import './index.css'
import App from './App.jsx'

const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TamaguiProvider config={config} defaultTheme={prefersDark ? 'dark' : 'light'}>
      <App />
    </TamaguiProvider>
  </StrictMode>,
)
