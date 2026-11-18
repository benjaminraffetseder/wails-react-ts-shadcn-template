import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it } from "vitest"
import i18n from "@/i18n"
import { App } from "@/app"
import { appSettingsStore } from "@/lib/app-settings"
import { createPreviewAdapter } from "@/lib/settings-adapters"

beforeEach(async () => {
  localStorage.clear()
  window.location.hash = "#/"
  await i18n.changeLanguage("en")
  const adapter = createPreviewAdapter()
  await adapter.reset()
  await appSettingsStore.initialize(adapter)
})

it("launches the complete browser preview and keeps native actions disabled", async () => {
  const user = userEvent.setup()
  render(<App />)
  expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Open file" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
  expect(
    (screen.getByRole("button", { name: "Copy text" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
  await user.click(screen.getByRole("link", { name: "Settings" }))
  expect(window.location.hash).toBe("#/settings")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Dark" }))
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  )
  await user.click(screen.getByRole("button", { name: "Deutsch" }))
  expect(
    await screen.findByRole("heading", { name: "Einstellungen" }),
  ).toBeTruthy()
  expect(await createPreviewAdapter().load()).toMatchObject({
    theme: "dark",
    language: "de",
  })
  await act(async () => {
    await i18n.changeLanguage("en")
  })
})

it("keeps the direct settings route available", async () => {
  window.location.hash = "#/settings"
  render(<App />)
  expect(
    await screen.findByRole("heading", { name: "Settings", level: 1 }),
  ).toBeTruthy()
  expect(screen.queryByRole("dialog")).toBeNull()
})
