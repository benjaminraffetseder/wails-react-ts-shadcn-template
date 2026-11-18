export type Theme = "light" | "dark" | "system"
export type Language = "en" | "de"
export type AppSettings = {
  schemaVersion: number
  revision: number
  theme: Theme
  language: Language
}
export type SettingsPatch = Partial<Pick<AppSettings, "theme" | "language">>
export type SettingsAdapter = {
  source: "native" | "preview"
  load: () => Promise<AppSettings>
  update: (patch: SettingsPatch) => Promise<AppSettings>
  reset: () => Promise<AppSettings>
}
export const defaultSettings: AppSettings = {
  schemaVersion: 1,
  revision: 0,
  theme: "system",
  language: "en",
}

export function parseSettings(value: unknown): AppSettings {
  if (typeof value !== "object" || !value) throw new Error("settings:corrupt")
  const settings = value as AppSettings
  if (
    settings.schemaVersion !== 1 ||
    !Number.isSafeInteger(settings.revision) ||
    settings.revision < 0 ||
    !["light", "dark", "system"].includes(settings.theme) ||
    !["en", "de"].includes(settings.language)
  )
    throw new Error("settings:corrupt: invalid preferences")
  return { ...settings }
}

export function createSettingsStore() {
  let adapter: SettingsAdapter | undefined
  let pending = 0
  let generation = 0
  let readID = 0
  let loading = false
  let saveFailed = false
  let queue: Promise<unknown> = Promise.resolve()
  let state = {
    settings: { ...defaultSettings },
    source: "preview" as SettingsAdapter["source"],
    status: "loading" as "loading" | "saving" | "ready" | "error",
    error: null as Error | null,
  }
  const listeners = new Set<() => void>()
  const publish = (next: Partial<typeof state>) => {
    state = { ...state, ...next }
    listeners.forEach((listener) => listener())
  }
  const status = () =>
    loading ? "loading" : pending ? "saving" : state.error ? "error" : "ready"
  function accept(settings: AppSettings) {
    if (settings.revision < state.settings.revision) return false
    publish({ settings })
    return true
  }
  function acceptLoaded(settings: AppSettings, previous: AppSettings) {
    if (adapter?.source === "preview") {
      // Browser storage can be cleared or replaced with an older record. A
      // fresh read is authoritative unless another update arrived meanwhile.
      if (state.settings !== previous) return false
      publish({ settings })
      return true
    }
    return accept(settings)
  }
  async function loadSettings(current: SettingsAdapter, owner: number) {
    if (owner !== generation) return
    const request = ++readID
    const previous = state.settings
    const isCurrent = () => owner === generation && request === readID
    try {
      const value = await current.load()
      if (!isCurrent()) return
      const settings = parseSettings(value)
      if (acceptLoaded(settings, previous) && !saveFailed)
        publish({ error: null })
    } catch (cause) {
      // Events and writes can make a read obsolete without replacing its adapter.
      if (isCurrent() && state.settings === previous && !saveFailed)
        publish({
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
    } finally {
      if (isCurrent()) {
        loading = false
        publish({ status: status() })
      }
    }
  }
  function operation(action: () => Promise<AppSettings>) {
    const owner = generation
    // A new write owns the next error/status transition, even if it fails.
    ++readID
    loading = false
    const ensureCurrent = () => {
      if (owner !== generation)
        throw new Error(
          "settings:unavailable: settings adapter changed; operation superseded",
        )
    }
    pending++
    publish({ status: "saving", error: null })
    const result = queue.then(async () => {
      try {
        ensureCurrent()
        const settings = parseSettings(await action())
        ensureCurrent()
        accept(settings)
        saveFailed = false
        publish({ error: null })
        return settings
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error(String(cause))
        if (owner === generation) {
          saveFailed = true
          publish({ error })
        }
        throw error
      } finally {
        if (owner === generation) {
          pending--
          publish({ status: status() })
        }
      }
    })
    queue = result.catch(() => undefined)
    return result
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    async initialize(nextAdapter: SettingsAdapter) {
      const owner = ++generation
      const changedSource = state.source !== nextAdapter.source
      adapter = nextAdapter
      queue = Promise.resolve()
      pending = 0
      loading = true
      saveFailed = false
      publish({
        source: adapter.source,
        status: "loading",
        error: null,
        settings: changedSource ? { ...defaultSettings } : state.settings,
      })
      await loadSettings(nextAdapter, owner)
    },
    accept,
    async refresh() {
      const current = adapter
      if (!current) return
      await loadSettings(current, generation)
    },
    updateSettings(patch: SettingsPatch) {
      const current = adapter
      return operation(() => {
        if (!current)
          throw new Error("settings:unavailable: settings have not loaded")
        return current.update(patch)
      })
    },
    resetSettings() {
      const current = adapter
      return operation(() => {
        if (!current)
          throw new Error("settings:unavailable: settings have not loaded")
        return current.reset()
      })
    },
  }
}
