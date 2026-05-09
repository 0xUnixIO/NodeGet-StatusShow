import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      richColors
      visibleToasts={1}
      toastOptions={{
        duration: Infinity,
        style: {
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: '11px',
          letterSpacing: '0.02em',
        },
      }}
    />
  )
}
