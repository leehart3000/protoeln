export type Theme = 'light' | 'dark'

// Also read by public/theme.js. Not just 'theme': during development ProtoLIMS runs on the same
// localhost origin, and browsers share storage between apps on the same origin.
export const THEME_KEY = 'protoeln-theme'

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage can be blocked (e.g. some private windows); the choice just won't be remembered.
  }
}
