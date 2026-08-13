import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyLocationPreferenceFromUrl } from './lib/location'

// Before mount: components read this preference in their initial state.
applyLocationPreferenceFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
