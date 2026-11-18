import { useMemo, useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, expect, it, vi } from "vitest"
import i18n from "@/i18n"
import {
  CommandProvider,
  useCommandPalette,
  useCommands,
} from "@/components/command-palette"
import { appSettingsStore } from "@/lib/app-settings"
import { createPreviewAdapter } from "@/lib/settings-adapters"
import { createCommandRegistry, type AppCommand } from "@/lib/commands"
import { Input } from "@/components/ui/input"

beforeEach(async () => {
  localStorage.clear()
  await i18n.changeLanguage("en")
  await appSettingsStore.initialize(createPreviewAdapter())
})
function Launcher() {
  const { openPalette } = useCommandPalette()
  const location = useLocation()
  return (
    <>
      <button data-command-launcher onClick={openPalette}>
        Open palette
      </button>
      <output data-testid="route">{location.pathname}</output>
    </>
  )
}
function mount(extra?: React.ReactNode) {
  return render(
    <MemoryRouter>
      <CommandProvider>
        <Launcher />
        {extra}
      </CommandProvider>
    </MemoryRouter>,
  )
}

it("opens with keyboard, navigates with arrows/Enter, and restores focus on Escape", async () => {
  const user = userEvent.setup()
  mount()
  const launcher = screen.getByRole("button", { name: "Open palette" })
  launcher.focus()
  await user.keyboard("{Control>}k{/Control}")
  const search = await screen.findByRole("combobox", {
    name: "Search commands…",
  })
  expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy()
  await user.type(search, "Navigation")
  await user.keyboard("{ArrowDown}{Enter}")
  await waitFor(() =>
    expect(screen.getByTestId("route").textContent).toBe("/settings"),
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(launcher))
  await user.click(launcher)
  await screen.findByRole("combobox")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(launcher))
})

it("updates shared preferences and uses translated labels and empty state", async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await user.click(await screen.findByRole("option", { name: "Dark" }))
  await waitFor(() =>
    expect(appSettingsStore.getSnapshot().settings.theme).toBe("dark"),
  )
  await act(async () => {
    await i18n.changeLanguage("de")
  })
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  const search = await screen.findByRole("combobox", {
    name: "Befehle suchen…",
  })
  expect(screen.getByRole("option", { name: "Einstellungen" })).toBeTruthy()
  await user.type(search, "zzzzzz")
  expect(await screen.findByText("Keine Befehle gefunden.")).toBeTruthy()
})

it("styles only the active cmdk row and moves selection across groups", async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await screen.findByRole("combobox")
  const rows = screen.getAllByRole("option")
  // cmdk emits both data-selected="true" and data-selected="false".
  // Presence variants would incorrectly highlight every inactive row.
  rows.forEach((row) => {
    expect(row.className).not.toMatch(/(?:^|\s)data-selected:/)
    expect(row.className).toContain("data-[selected=true]:bg-muted")
  })
  expect(
    rows.filter((row) => row.matches('[data-selected="true"]')),
  ).toHaveLength(1)
  await user.keyboard("{ArrowDown}{ArrowDown}")
  expect(
    screen.getByRole("option", { name: "Light" }).getAttribute("data-selected"),
  ).toBe("true")
  expect(
    rows.filter((row) => row.matches('[data-selected="true"]')),
  ).toHaveLength(1)
})

it("runs async commands once, displays failure, and unregisters feature commands", async () => {
  const user = userEvent.setup()
  let reject: (error: Error) => void = () => undefined
  const run = vi.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail
      }),
  )
  function Feature() {
    const commands = useMemo<AppCommand[]>(
      () => [
        {
          id: "feature",
          group: "Feature",
          label: "Feature command",
          restoreFocus: false,
          run,
        },
      ],
      [],
    )
    useCommands(commands)
    return null
  }
  const view = mount(<Feature />)
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  const command = await screen.findByRole("option", { name: "Feature command" })
  fireEvent.click(command)
  fireEvent.click(command)
  expect(run).toHaveBeenCalledOnce()
  await act(async () => {
    reject(new Error("failed command"))
  })
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(screen.getByRole("dialog")).toBeTruthy()
  await user.keyboard("{Escape}")
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Open palette" }),
    ),
  )
  view.unmount()
  mount()
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await screen.findByRole("combobox")
  expect(screen.queryByRole("option", { name: "Feature command" })).toBeNull()
})

it("lets feature commands hand focus to a new editor", async () => {
  const user = userEvent.setup()
  function Feature() {
    const [editing, setEditing] = useState(false)
    const commands = useMemo<AppCommand[]>(
      () => [
        {
          id: "feature.edit",
          group: "Feature",
          label: "Edit feature",
          restoreFocus: false,
          run: () => setEditing(true),
        },
      ],
      [],
    )
    useCommands(commands)
    return editing ? <Input autoFocus aria-label="Editor" /> : null
  }
  mount(<Feature />)
  await user.click(screen.getByRole("button", { name: "Open palette" }))
  await user.click(await screen.findByRole("option", { name: "Edit feature" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Editor" }),
    ),
  )
})

it("honors an already-owned shortcut and cleans up its keyboard handler", async () => {
  const view = mount()
  const owned = new KeyboardEvent("keydown", {
    key: "k",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  owned.preventDefault()
  act(() => {
    window.dispatchEvent(owned)
  })
  expect(screen.queryByRole("dialog")).toBeNull()
  view.unmount()
  const released = new KeyboardEvent("keydown", {
    key: "k",
    metaKey: true,
    cancelable: true,
  })
  window.dispatchEvent(released)
  expect(released.defaultPrevented).toBe(false)
})

it("requires unique command IDs and returns an unregister function", () => {
  const registry = createCommandRegistry()
  const command = {
    id: "one",
    group: "Test",
    label: "One",
    run: () => undefined,
  }
  const unregister = registry.register(command)
  expect(() => registry.register(command)).toThrow("Duplicate command ID")
  unregister()
  expect(registry.getSnapshot()).toEqual([])
})
