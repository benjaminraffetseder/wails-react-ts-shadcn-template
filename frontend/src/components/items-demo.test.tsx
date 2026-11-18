import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import i18n from "@/i18n"
import { ItemsDemo } from "@/components/items-demo"

const mock = vi.hoisted(() => ({
  desktop: true,
  records: [] as { id: number; title: string; done: boolean }[],
  load: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock("@/hooks/use-desktop", () => ({ useDesktop: () => mock.desktop }))
vi.mock("@wails/itemsservice", () => ({
  GetItems: mock.load,
  AddItem: mock.add,
  UpdateItem: mock.update,
  DeleteItem: mock.remove,
}))

beforeEach(async () => {
  await i18n.changeLanguage("en")
  mock.desktop = true
  mock.records = []
  mock.load
    .mockReset()
    .mockImplementation(async () => mock.records.map((item) => ({ ...item })))
  mock.add.mockReset().mockImplementation(async (title: string) => {
    const item = { id: 1, title, done: false }
    mock.records.push(item)
    return item
  })
  mock.update
    .mockReset()
    .mockImplementation(async (id: number, title: string, done: boolean) => {
      const item = { id, title, done }
      mock.records = mock.records.map((record) =>
        record.id === id ? item : record,
      )
      return item
    })
  mock.remove.mockReset().mockImplementation(async (id: number) => {
    mock.records = mock.records.filter((item) => item.id !== id)
  })
})

it("loads and performs CRUD in native mode without a feature flag", async () => {
  const user = userEvent.setup()
  render(<ItemsDemo />)
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  await user.type(
    screen.getByRole("textbox", { name: "New item title" }),
    "First item",
  )
  await user.click(screen.getByRole("button", { name: "Add" }))
  const title = await screen.findByRole("textbox", { name: "Title for item 1" })
  expect((title as HTMLInputElement).value).toBe("First item")
  await user.clear(title)
  await user.type(title, "Updated item")
  await user.click(screen.getByRole("button", { name: "Save title" }))
  await waitFor(() =>
    expect(mock.update).toHaveBeenCalledWith(1, "Updated item", false),
  )
  await user.click(screen.getByRole("button", { name: "Mark complete" }))
  expect(await screen.findByRole("button", { name: "Completed" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Delete" }))
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  expect(mock.remove).toHaveBeenCalledWith(1)
})

it("exposes initialization and migration failures", async () => {
  mock.load.mockRejectedValueOnce(
    new Error("items:migration: failed to apply schema"),
  )
  render(<ItemsDemo />)
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(
    screen.getByText("items:migration: failed to apply schema"),
  ).toBeTruthy()
})

it("explains browser preview without calling native CRUD", () => {
  mock.desktop = false
  render(<ItemsDemo />)
  expect(
    screen.getByText(
      "SQLite runs in the native desktop app. Start wails3 dev to try this example.",
    ),
  ).toBeTruthy()
  expect(mock.load).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
})
