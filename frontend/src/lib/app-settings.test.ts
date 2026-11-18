import { expect, it, vi } from "vitest"
import { defaultSettings, type SettingsAdapter } from "@/lib/app-settings-store"

const mock = vi.hoisted(() => ({ native: vi.fn(), preview: vi.fn() }))
vi.mock("@/lib/settings-adapters", () => ({
  createNativeAdapter: mock.native,
  createPreviewAdapter: mock.preview,
}))

it("does not install an adapter whose creation was superseded", async () => {
  const adapter = (source: SettingsAdapter["source"]): SettingsAdapter => ({
    source,
    load: async () => ({
      ...defaultSettings,
      theme: source === "native" ? "dark" : "light",
    }),
    update: async () => defaultSettings,
    reset: async () => defaultSettings,
  })
  let finish: (value: SettingsAdapter) => void = () => undefined
  mock.native.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  mock.preview.mockReturnValueOnce(adapter("preview"))
  const { initializeAppSettings, appSettingsStore } =
    await import("@/lib/app-settings")
  const old = initializeAppSettings(true)
  await initializeAppSettings(false)
  finish(adapter("native"))
  await old
  expect(appSettingsStore.getSnapshot()).toMatchObject({
    source: "preview",
    settings: { theme: "light" },
  })
})
