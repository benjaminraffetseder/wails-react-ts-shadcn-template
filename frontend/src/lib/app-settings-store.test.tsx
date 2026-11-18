import { useSyncExternalStore } from "react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  createSettingsStore,
  defaultSettings,
  type SettingsAdapter,
} from "@/lib/app-settings-store"
import {
  createPreviewAdapter,
  createNativeAdapter,
  previewSettingsKey,
} from "@/lib/settings-adapters"

function fixture() {
  let value = { ...defaultSettings }
  const adapter: SettingsAdapter = {
    source: "native",
    load: async () => value,
    update: vi.fn(async (patch) => {
      value = { ...value, ...patch, revision: value.revision + 1 }
      return value
    }),
    reset: async () => {
      value = { ...defaultSettings, revision: value.revision + 1 }
      return value
    },
  }
  return { store: createSettingsStore(), adapter }
}

describe("shared application settings", () => {
  it.each(["native", "preview"] as const)(
    "ignores an old %s read failure after a successful reset",
    async (source) => {
      const { store, adapter } = fixture()
      adapter.source = source
      await store.initialize(adapter)
      let fail: (error: Error) => void = () => undefined
      adapter.load = () =>
        new Promise((_, reject) => {
          fail = reject
        })
      const oldRead = store.refresh()
      await store.resetSettings()
      fail(new Error("old read failed"))
      await oldRead
      expect(store.getSnapshot()).toMatchObject({
        status: "ready",
        error: null,
      })
    },
  )

  it.each(["native", "preview"] as const)(
    "keeps a newer %s read error when an older read succeeds",
    async (source) => {
      const { store, adapter } = fixture()
      adapter.source = source
      await store.initialize(adapter)
      let finish: (value: typeof defaultSettings) => void = () => undefined
      adapter.load = () =>
        new Promise((resolve) => {
          finish = resolve
        })
      const oldRead = store.refresh()
      adapter.load = async () => {
        throw new Error("current read failed")
      }
      await store.refresh()
      finish({ ...defaultSettings })
      await oldRead
      expect(store.getSnapshot()).toMatchObject({
        status: "error",
        error: { message: "current read failed" },
      })
    },
  )

  it("does not let a stale read replace a failed-save error", async () => {
    const { store, adapter } = fixture()
    await store.initialize(adapter)
    let fail: (error: Error) => void = () => undefined
    adapter.load = () =>
      new Promise((_, reject) => {
        fail = reject
      })
    const oldRead = store.refresh()
    adapter.update = async () => {
      throw new Error("save failed")
    }
    await expect(store.updateSettings({ theme: "dark" })).rejects.toThrow(
      "save failed",
    )
    fail(new Error("old read failed"))
    await oldRead
    expect(store.getSnapshot().error?.message).toBe("save failed")
  })

  it("keeps loading until the read that superseded initialization completes", async () => {
    const { store, adapter } = fixture()
    let finishInitial: (value: typeof defaultSettings) => void = () => undefined
    adapter.load = () =>
      new Promise((resolve) => {
        finishInitial = resolve
      })
    const initial = store.initialize(adapter)
    let finishCurrent: (value: typeof defaultSettings) => void = () => undefined
    adapter.load = () =>
      new Promise((resolve) => {
        finishCurrent = resolve
      })
    const current = store.refresh()
    finishInitial({ ...defaultSettings })
    await initial
    expect(store.getSnapshot().status).toBe("loading")
    finishCurrent({ ...defaultSettings, revision: 1, theme: "dark" })
    await current
    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      error: null,
      settings: { theme: "dark" },
    })
  })

  it("ignores an initialization failure after settings were saved", async () => {
    const { store, adapter } = fixture()
    let fail: (error: Error) => void = () => undefined
    adapter.load = () =>
      new Promise((_, reject) => {
        fail = reject
      })
    const initial = store.initialize(adapter)
    await store.updateSettings({ theme: "dark" })
    fail(new Error("initial read failed"))
    await initial
    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      error: null,
      settings: { theme: "dark" },
    })
  })

  it("reflects cleared browser storage after refresh", async () => {
    localStorage.clear()
    const adapter = createPreviewAdapter()
    const store = createSettingsStore()
    await store.initialize(adapter)
    await store.updateSettings({ theme: "dark" })
    await store.updateSettings({ language: "de" })
    localStorage.clear()
    await store.refresh()
    expect(store.getSnapshot().settings).toEqual(await adapter.load())
  })

  it("reflects successful saves after reinitializing cleared browser storage", async () => {
    localStorage.clear()
    const store = createSettingsStore()
    await store.initialize(createPreviewAdapter())
    await store.updateSettings({ theme: "dark" })
    await store.updateSettings({ language: "de" })
    localStorage.clear()
    await store.initialize(createPreviewAdapter())
    const saved = await store.updateSettings({ theme: "light" })
    expect(saved.theme).toBe("light")
    expect(store.getSnapshot()).toMatchObject({
      status: "ready",
      settings: saved,
    })
    expect(await createPreviewAdapter().load()).toEqual(saved)
  })

  it("does not let a delayed preview read undo a storage reset", async () => {
    const { store, adapter } = fixture()
    adapter.source = "preview"
    const oldSettings = {
      ...defaultSettings,
      revision: 10,
      theme: "dark" as const,
    }
    adapter.load = async () => oldSettings
    await store.initialize(adapter)
    let finish: (value: typeof defaultSettings) => void = () => undefined
    adapter.load = () =>
      new Promise((resolve) => {
        finish = resolve
      })
    const oldRead = store.refresh()
    adapter.load = async () => ({ ...defaultSettings })
    await store.refresh()
    finish(oldSettings)
    await oldRead
    expect(store.getSnapshot().settings).toEqual(defaultSettings)
  })

  it("uses the latest preview read when storage is cleared between overlapping refreshes", async () => {
    localStorage.clear()
    const adapter = createPreviewAdapter()
    const store = createSettingsStore()
    await store.initialize(adapter)
    await store.updateSettings({ theme: "dark" })
    const oldRead = store.refresh()
    localStorage.clear()
    const newRead = store.refresh()
    await Promise.all([oldRead, newRead])
    expect(store.getSnapshot().settings).toEqual(await adapter.load())
  })

  it("keeps preview resets newer than writes even when the clock does not advance", async () => {
    vi.spyOn(Date, "now").mockReturnValue(100)
    localStorage.clear()
    const store = createSettingsStore()
    await store.initialize(createPreviewAdapter())
    await store.resetSettings()
    await store.updateSettings({ theme: "dark" })
    await store.resetSettings()
    expect(store.getSnapshot().settings.theme).toBe("system")
    await store.updateSettings({ theme: "dark" })
    localStorage.setItem(previewSettingsKey, "{broken")
    await store.resetSettings()
    expect(store.getSnapshot().settings.theme).toBe("system")
  })
  it("keeps a newer event when the initial read finishes late", async () => {
    const { store, adapter } = fixture()
    let complete: (value: typeof defaultSettings) => void = () => undefined
    adapter.load = () =>
      new Promise((resolve) => {
        complete = resolve
      })
    const loading = store.initialize(adapter)
    store.accept({ ...defaultSettings, revision: 3, theme: "dark" })
    complete({ ...defaultSettings, revision: 2, theme: "light" })
    await loading
    expect(store.getSnapshot().settings.theme).toBe("dark")
  })

  it("ignores a superseded adapter's initial read", async () => {
    const { store, adapter } = fixture()
    let complete: (value: typeof defaultSettings) => void = () => undefined
    adapter.load = () =>
      new Promise((resolve) => {
        complete = resolve
      })
    const oldLoad = store.initialize(adapter)
    await store.initialize({
      ...adapter,
      source: "preview",
      load: async () => ({ ...defaultSettings, revision: 1, language: "de" }),
    })
    complete({ ...defaultSettings, revision: 999, language: "en" })
    await oldLoad
    expect(store.getSnapshot()).toMatchObject({
      source: "preview",
      settings: { language: "de" },
    })
  })

  it("does not apply an old adapter's pending write to native preferences", async () => {
    const { store, adapter } = fixture()
    let complete: (value: typeof defaultSettings) => void = () => undefined
    adapter.source = "preview"
    adapter.update = () =>
      new Promise((resolve) => {
        complete = resolve
      })
    await store.initialize(adapter)
    const saving = store.updateSettings({ theme: "dark" })
    const rejected = expect(saving).rejects.toThrow(/changed|superseded/i)
    await Promise.resolve()
    await store.initialize({
      ...adapter,
      source: "native",
      load: async () => ({ ...defaultSettings, revision: 1, theme: "light" }),
    })
    complete({ ...defaultSettings, revision: 999, theme: "dark" })
    await rejected
    expect(store.getSnapshot()).toMatchObject({
      source: "native",
      status: "ready",
      settings: { theme: "light" },
    })
  })

  it("clears a load error after a successful refresh but retains failed-save errors", async () => {
    const { store, adapter } = fixture()
    adapter.load = async () => {
      throw new Error("read failed")
    }
    await store.initialize(adapter)
    adapter.load = async () => ({ ...defaultSettings })
    await store.refresh()
    expect(store.getSnapshot()).toMatchObject({ status: "ready", error: null })
    adapter.update = async () => {
      throw new Error("save failed")
    }
    await expect(store.updateSettings({ theme: "dark" })).rejects.toThrow(
      "save failed",
    )
    await store.refresh()
    expect(store.getSnapshot().error?.message).toBe("save failed")
  })

  it("refuses a native adapter in browser preview", async () => {
    await expect(createNativeAdapter()).rejects.toMatchObject({
      code: "unavailable",
    })
  })
  it("updates two mounted consumers and merges queued partial writes", async () => {
    const { store, adapter } = fixture()
    await store.initialize(adapter)
    function Consumer({ id }: { id: string }) {
      const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
      return (
        <output data-testid={id}>
          {state.settings.theme}/{state.settings.language}
        </output>
      )
    }
    render(
      <>
        <Consumer id="one" />
        <Consumer id="two" />
      </>,
    )
    await act(async () => {
      await Promise.all([
        store.updateSettings({ theme: "dark" }),
        store.updateSettings({ language: "de" }),
      ])
    })
    expect(screen.getByTestId("one").textContent).toBe("dark/de")
    expect(screen.getByTestId("two").textContent).toBe("dark/de")
    await act(async () => {
      await store.resetSettings()
    })
    expect(screen.getByTestId("one").textContent).toBe("system/en")
  })
  it("does not present a pending or failed write as saved", async () => {
    const { store, adapter } = fixture()
    let rejectSave: (error: Error) => void = () => undefined
    adapter.update = () =>
      new Promise((_, reject) => {
        rejectSave = reject
      })
    await store.initialize(adapter)
    const save = store.updateSettings({ theme: "dark" })
    expect(store.getSnapshot().status).toBe("saving")
    expect(store.getSnapshot().settings.theme).toBe("system")
    await Promise.resolve()
    rejectSave(new Error("settings:io: permission denied"))
    await expect(save).rejects.toThrow("permission denied")
    expect(store.getSnapshot().settings.theme).toBe("system")
    expect(store.getSnapshot().status).toBe("error")
  })
  it("ignores stale events and preserves native adapter errors", async () => {
    const { store, adapter } = fixture()
    await store.initialize(adapter)
    store.accept({ ...defaultSettings, revision: 5, theme: "dark" })
    store.accept({ ...defaultSettings, revision: 2, theme: "light" })
    expect(store.getSnapshot().settings.theme).toBe("dark")
    adapter.load = async () => {
      throw new Error("settings:corrupt")
    }
    await store.initialize(adapter)
    expect(store.getSnapshot().source).toBe("native")
    expect(store.getSnapshot().error?.message).toBe("settings:corrupt")
  })
  it("preview persists locally and rejects storage failures", async () => {
    localStorage.clear()
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de-AT", "en-US"])
    const adapter = createPreviewAdapter()
    expect(await adapter.load()).toMatchObject({
      theme: "system",
      language: "de",
    })
    await adapter.update({ theme: "light" })
    expect(await createPreviewAdapter().load()).toMatchObject({
      theme: "light",
      language: "de",
    })
    localStorage.setItem(previewSettingsKey, "{broken")
    await expect(adapter.load()).rejects.toThrow()
    await adapter.reset()
    expect(await adapter.load()).toMatchObject({
      theme: "system",
      language: "en",
    })
    const denied = createPreviewAdapter({
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked storage")
      },
    } as unknown as Storage)
    await expect(denied.update({ theme: "dark" })).rejects.toThrow(
      "blocked storage",
    )
  })
})
