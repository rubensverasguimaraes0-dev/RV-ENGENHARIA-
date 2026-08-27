'use client'

import { useEffect } from 'react'

/** Registra o service worker do PWA (instalavel no celular e no computador). */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sem service worker o app continua funcionando online
    })
  }, [])
  return null
}
