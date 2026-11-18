import { useEffect, useLayoutEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useAppSettings } from "@/hooks/use-app-settings"
import { useDesktop } from "@/hooks/use-desktop"
import { useWailsEvent } from "@/hooks/use-wails-event"
import { appSettingsStore, initializeAppSettings } from "@/lib/app-settings"
import { parseSettings } from "@/lib/app-settings-store"
import { previewSettingsKey } from "@/lib/settings-adapters"

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const desktop = useDesktop()
  const { i18n, t } = useTranslation()
  const { settings, isLoading } = useAppSettings()
  useWailsEvent("settings:changed", (event) => {
    try {
      appSettingsStore.accept(parseSettings(event.data))
    } catch {
      void appSettingsStore.refresh()
    }
  })
  useEffect(() => {
    if (!desktop && appSettingsStore.getSnapshot().source === "native") return
    void initializeAppSettings(desktop).then(() => appSettingsStore.refresh())
  }, [desktop])
  useEffect(() => {
    if (desktop) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === previewSettingsKey || event.key === null)
        void appSettingsStore.refresh()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [desktop])
  useLayoutEffect(() => {
    if (!isLoading && i18n.resolvedLanguage !== settings.language)
      void i18n.changeLanguage(settings.language)
  }, [i18n, isLoading, settings.language])
  if (isLoading)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    )
  return children
}
