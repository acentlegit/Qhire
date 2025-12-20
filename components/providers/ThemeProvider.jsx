'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const ThemeContext = createContext({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light'
})

export function ThemeProvider({ children }) {
  const { data: session } = useSession()
  const [theme, setThemeState] = useState('system')
  const [mounted, setMounted] = useState(false)

  // Load theme from user profile or localStorage
  useEffect(() => {
    setMounted(true)
    loadTheme()
  }, [session])

  const loadTheme = async () => {
    try {
      // First, try to get theme from user profile
      if (session?.user?.id) {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          if (data.theme) {
            setThemeState(data.theme)
            applyTheme(data.theme)
            return
          }
        }
      }
      
      // Fallback to localStorage
      const savedTheme = localStorage.getItem('theme') || 'system'
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } catch (error) {
      console.error('Error loading theme:', error)
      // Fallback to system
      const savedTheme = localStorage.getItem('theme') || 'system'
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    }
  }

  const applyTheme = (newTheme) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(newTheme)
    }
  }

  const setTheme = async (newTheme) => {
    setThemeState(newTheme)
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)

    // Save to user profile if logged in
    if (session?.user?.id) {
      try {
        await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: newTheme })
        })
      } catch (error) {
        console.error('Error saving theme to profile:', error)
      }
    }
  }

  // Listen for system theme changes
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Get resolved theme (actual theme being used)
  const resolvedTheme = theme === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

