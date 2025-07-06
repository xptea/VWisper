import React from 'react'
import ReactDOM from 'react-dom/client'
import BubbleWindow from './components/WaveWindow.tsx'
import './components/WaveWindow.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BubbleWindow />
  </React.StrictMode>,
) 