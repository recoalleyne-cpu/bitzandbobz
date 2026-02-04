import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { brand, brandCssVars } from '@bitz/config/brand'
import './index.css'
import App from './App'

for (const [key, value] of Object.entries(brandCssVars)) {
  document.documentElement.style.setProperty(key, value)
}

document.title = `${brand.storeName} Admin`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
