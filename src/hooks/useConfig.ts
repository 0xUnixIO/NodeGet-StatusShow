import { useEffect, useState } from 'react'
import type { SiteConfig } from '../types'

export function useConfig() {
  const [config, setConfig] = useState<SiteConfig | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let alive = true
    fetch('config.json', { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`config.json ${r.status}`)
        return r.json() as Promise<SiteConfig>
      })
      .then(c => alive && setConfig(c))
      .catch(e => alive && setError(e))
    return () => {
      alive = false
    }
  }, [])

  return { config, error }
}
