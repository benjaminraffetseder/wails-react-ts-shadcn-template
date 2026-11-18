import { useLayoutEffect, type ReactNode } from "react"
import { useAppSettings } from "@/hooks/use-app-settings"
import type { Theme } from "@/lib/app-settings-store"

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  useLayoutEffect(() => {
    const apply = () => applyTheme(settings.theme)
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [settings.theme])
  return children
}

export function useTheme() {
  const { settings, updateSettings } = useAppSettings()
  return {
    theme: settings.theme,
    setTheme: (theme: Theme) => updateSettings({ theme }),
  }
}
