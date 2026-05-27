'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { type Language, t as translationDict } from './translations'

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('smartbiz_language')
      if (saved === 'sw' || saved === 'en') {
        return saved
      }
    } catch {
      // ignore
    }
  }
  return 'en'
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

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

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

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
