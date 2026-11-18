import { createSettingsStore } from "@/lib/app-settings-store"
import {
  createNativeAdapter,
  createPreviewAdapter,
} from "@/lib/settings-adapters"

export const appSettingsStore = createSettingsStore()
let initializedSource: boolean | undefined
let initialization: Promise<void> | undefined
let initializationID = 0

export function initializeAppSettings(
  native: boolean,
  retry = false,
): Promise<void> {
  if (!retry && initializedSource === native && initialization)
    return initialization
  initializedSource = native
  const owner = ++initializationID
  initialization = (async () => {
    try {
      const adapter = native
        ? await createNativeAdapter()
        : createPreviewAdapter()
      if (owner === initializationID) await appSettingsStore.initialize(adapter)
    } catch (error) {
      if (owner !== initializationID) return
      const fail = async (): Promise<never> => {
        throw error
      }
      await appSettingsStore.initialize({
        source: native ? "native" : "preview",
        load: fail,
        update: fail,
        reset: fail,
      })
    }
  })()
  return initialization
}

export async function failNativeSettings(error: unknown) {
  initializationID++
  initializedSource = true
  const fail = async (): Promise<never> => {
    throw error
  }
  initialization = appSettingsStore.initialize({
    source: "native",
    load: fail,
    update: fail,
    reset: fail,
  })
  await initialization
}
