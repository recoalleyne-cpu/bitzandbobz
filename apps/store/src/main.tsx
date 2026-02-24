import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { brand } from '@bitz/config/brand'
import './index.css'
import App from './App.tsx'

const cssVars = {
  '--brand-primary': brand.primaryColor,
  '--brand-secondary': brand.secondaryColor,
} as const

for (const [key, value] of Object.entries(cssVars)) {
  document.documentElement.style.setProperty(key, String(value))
}

document.title = brand.name

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
