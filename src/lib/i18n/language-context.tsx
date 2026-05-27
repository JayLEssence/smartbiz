'use client'

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import { type Language, t as translationDict } from './translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  mounted: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
  mounted: false,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with 'en' to match server-side rendering and avoid hydration mismatch
  const [language, setLanguageState] = useState<Language>('en')
  const [mounted, setMounted] = useState(false)

  // After hydration, read saved language preference from localStorage
  // This is the correct React pattern for avoiding hydration mismatches
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartbiz_language')
      if (saved === 'sw' || saved === 'en') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLanguageState(saved)
      }
    } catch {
      // ignore
    }
    setMounted(true)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem('smartbiz_language', lang)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      const entry = translationDict[key]
      if (!entry) {
        return key
      }
      return entry[language] || entry.en || key
    },
    [language]
  )

  const value = useMemo(() => ({ language, setLanguage, t, mounted }), [language, setLanguage, t, mounted])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
