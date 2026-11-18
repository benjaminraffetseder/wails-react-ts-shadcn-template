import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import i18n from "@/i18n"
import { App } from "@/app"
import { applyTheme } from "@/components/theme-provider"
import {
  appSettingsStore,
  initializeAppSettings,
  failNativeSettings,
} from "@/lib/app-settings"
import { waitForDesktop } from "@/lib/desktop"
import "@/index.css"

try {
  await initializeAppSettings(await waitForDesktop())
} catch (error) {
  await failNativeSettings(error)
}
const { settings } = appSettingsStore.getSnapshot()
applyTheme(settings.theme)
await i18n.changeLanguage(settings.language)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
