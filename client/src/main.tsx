import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/*if (import.meta.env.PROD) {
  const script = document.createElement('script')
  script.defer = true
  script.src = 'https://analytics.vincentwill.com/script.js'
  script.setAttribute('data-website-id', '34db5e2a-40c4-4581-94c4-02881169f5f0')
  document.head.appendChild(script)
}*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
