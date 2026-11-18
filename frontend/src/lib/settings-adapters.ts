import {
  defaultSettings,
  parseSettings,
  type AppSettings,
  type SettingsAdapter,
} from "@/lib/app-settings-store"
import { requireDesktop } from "@/lib/desktop"

export const previewSettingsKey = "desktop-settings"

function browserDefaults(): AppSettings {
  const language =
    typeof navigator === "undefined"
      ? "en"
      : (navigator.languages
          .map((value) => value.toLowerCase().split("-")[0])
          .find((value) => value === "en" || value === "de") ?? "en")
  return {
    ...defaultSettings,
    language: language as "en" | "de",
  }
}

export function createPreviewAdapter(
  storage: Storage = localStorage,
): SettingsAdapter {
  let revision = 0
  const load = async () => {
    const saved = storage.getItem(previewSettingsKey)
    const settings = saved
      ? parseSettings(JSON.parse(saved))
      : browserDefaults()
    revision = Math.max(revision, settings.revision)
    return settings
  }
  const save = async (settings: AppSettings) => {
    // A failed localStorage write rejects; the store keeps the last saved value.
    parseSettings(settings)
    storage.setItem(previewSettingsKey, JSON.stringify(settings))
    revision = settings.revision
    return settings
  }
  return {
    source: "preview",
    load,
    update: async (patch) => {
      const current = await load()
      return save(
        parseSettings({ ...current, ...patch, revision: revision + 1 }),
      )
    },
    reset: async () => {
      // Keep the last observed revision even during explicit corrupt-file
      // recovery or when multiple operations happen in the same millisecond.
      try {
        await load()
      } catch {
        /* Reset may replace an invalid local record. */
      }
      return save({
        ...defaultSettings,
        revision: Math.max(Date.now(), revision + 1),
      })
    },
  }
}

export async function createNativeAdapter(): Promise<SettingsAdapter> {
  requireDesktop()
  const native = await import("@wails/settingsservice")
  const { Patch } = await import("@wails/internal/preferences/models")
  return {
    source: "native",
    load: async () => {
      requireDesktop()
      return parseSettings(await native.GetSettings())
    },
    update: async (patch) => {
      requireDesktop()
      return parseSettings(await native.UpdateSettings(new Patch(patch)))
    },
    reset: async () => {
      requireDesktop()
      return parseSettings(await native.ResetSettings())
    },
  }
}
