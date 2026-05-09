import { createRoot } from 'react-dom/client'
import { App } from './App'
import { TooltipProvider } from './components/ui/tooltip'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')
createRoot(root).render(
  <TooltipProvider delayDuration={100}>
    <App />
  </TooltipProvider>
)
