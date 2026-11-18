import { useSyncExternalStore } from "react"
import { appSettingsStore } from "@/lib/app-settings"

export function useAppSettings() {
  const state = useSyncExternalStore(
    appSettingsStore.subscribe,
    appSettingsStore.getSnapshot,
    appSettingsStore.getSnapshot,
  )
  return {
    ...state,
    isLoading: state.status === "loading",
    isSaving: state.status === "saving",
    updateSettings: appSettingsStore.updateSettings,
    resetSettings: appSettingsStore.resetSettings,
  }
}
