import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import i18n from "@/i18n"
import { WindowTitlebar } from "@/components/window-titlebar"

const mock = vi.hoisted(() => ({
  native: true,
  minimize: vi.fn(),
  toggle: vi.fn(),
  close: vi.fn(),
}))
vi.mock("@wailsio/runtime", () => ({
  System: { IsDesktop: () => mock.native },
  Window: {
    Minimise: mock.minimize,
    ToggleMaximise: mock.toggle,
    Close: mock.close,
  },
}))

beforeEach(async () => {
  await i18n.changeLanguage("en")
  mock.native = true
  mock.minimize.mockReset().mockResolvedValue(undefined)
  mock.toggle.mockReset().mockResolvedValue(undefined)
  mock.close.mockReset().mockResolvedValue(undefined)
})

it("controls the calling window and surfaces a failed close", async () => {
  const user = userEvent.setup()
  mock.close.mockRejectedValue(new Error("Window close failed"))
  render(<WindowTitlebar />)
  await user.click(screen.getByRole("button", { name: "Minimize" }))
  await waitFor(() => expect(mock.minimize).toHaveBeenCalledOnce())
  await user.click(screen.getByRole("button", { name: "Maximize / restore" }))
  await waitFor(() => expect(mock.toggle).toHaveBeenCalledOnce())
  await user.click(screen.getByRole("button", { name: "Close" }))
  await screen.findByRole("alert")
  expect(mock.close).toHaveBeenCalledOnce()
})

it("disables native window controls in browser preview", async () => {
  const user = userEvent.setup()
  mock.native = false
  render(<WindowTitlebar />)
  for (const button of screen.getAllByRole("button")) {
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await user.click(button)
  }
  expect(mock.minimize).not.toHaveBeenCalled()
  expect(mock.toggle).not.toHaveBeenCalled()
  expect(mock.close).not.toHaveBeenCalled()
})
