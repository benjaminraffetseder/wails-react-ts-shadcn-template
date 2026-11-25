import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { onlineManager, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import i18n from "@/i18n"
import { ItemsDemo } from "@/components/items-demo"
import { createQueryClient } from "@/lib/query-client"

const mock = vi.hoisted(() => ({
  desktop: true,
  records: [] as { id: number; title: string; done: boolean }[],
  load: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock("@/hooks/use-desktop", () => ({ useDesktop: () => mock.desktop }))
vi.mock("@wails/internal/items/itemsservice", () => ({
  GetItems: mock.load,
  AddItem: mock.add,
  UpdateItem: mock.update,
  DeleteItem: mock.remove,
}))

let queryClient: ReturnType<typeof createQueryClient>

function renderItems() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ItemsDemo />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  queryClient.clear()
  onlineManager.setOnline(true)
})

beforeEach(async () => {
  queryClient = createQueryClient()
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
  renderItems()
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
  renderItems()
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(
    screen.getByText("items:migration: failed to apply schema"),
  ).toBeTruthy()
  expect(mock.load).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("explains browser preview without calling native CRUD", () => {
  mock.desktop = false
  renderItems()
  expect(
    screen.getByText(
      "SQLite runs in the native desktop app. Start wails3 dev to try this example.",
    ),
  ).toBeTruthy()
  expect(mock.load).not.toHaveBeenCalled()
  expect(mock.add).not.toHaveBeenCalled()
  expect(mock.update).not.toHaveBeenCalled()
  expect(mock.remove).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
})

it("reads and writes local data while offline", async () => {
  onlineManager.setOnline(false)
  const user = userEvent.setup()
  renderItems()
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  await user.type(
    screen.getByRole("textbox", { name: "New item title" }),
    "Offline item",
  )
  await user.click(screen.getByRole("button", { name: "Add" }))
  expect(
    await screen.findByRole("textbox", { name: "Title for item 1" }),
  ).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Delete" }))
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  expect(mock.add).toHaveBeenCalledTimes(1)
  expect(mock.remove).toHaveBeenCalledTimes(1)
})

it("reuses a fresh list after remounting with the same client", async () => {
  mock.records = [{ id: 1, title: "Cached item", done: false }]
  const first = renderItems()
  expect(
    await screen.findByRole("textbox", { name: "Title for item 1" }),
  ).toBeTruthy()
  first.unmount()
  renderItems()
  expect(
    (
      screen.getByRole("textbox", {
        name: "Title for item 1",
      }) as HTMLInputElement
    ).value,
  ).toBe("Cached item")
  expect(mock.load).toHaveBeenCalledTimes(1)
})

it("retries a failed refresh without repeating the successful write", async () => {
  const user = userEvent.setup()
  renderItems()
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  mock.load.mockRejectedValueOnce(new Error("items:query: failed to reload"))
  await user.type(
    screen.getByRole("textbox", { name: "New item title" }),
    "Saved item",
  )
  await user.click(screen.getByRole("button", { name: "Add" }))
  expect(await screen.findByText("items:query: failed to reload")).toBeTruthy()
  expect(
    (
      screen.getByRole("textbox", {
        name: "New item title",
      }) as HTMLInputElement
    ).value,
  ).toBe("")
  await user.click(screen.getByRole("button", { name: "Retry" }))
  expect(
    await screen.findByRole("textbox", { name: "Title for item 1" }),
  ).toBeTruthy()
  expect(mock.add).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("preserves the draft on write failure and permits a later successful write", async () => {
  const user = userEvent.setup()
  mock.add.mockRejectedValueOnce(new Error("items:constraint: could not save"))
  renderItems()
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  const input = screen.getByRole("textbox", {
    name: "New item title",
  }) as HTMLInputElement
  await user.type(input, "Retry this item")
  await user.click(screen.getByRole("button", { name: "Add" }))
  expect(
    await screen.findByText("items:constraint: could not save"),
  ).toBeTruthy()
  expect(input.value).toBe("Retry this item")
  expect(mock.add).toHaveBeenCalledTimes(1)
  expect(mock.load).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole("button", { name: "Add" }))
  expect(
    await screen.findByRole("textbox", { name: "Title for item 1" }),
  ).toBeTruthy()
  expect(input.value).toBe("")
  expect(screen.queryByRole("alert")).toBeNull()
})

it("blocks duplicate submissions and stays busy until the refreshed list arrives", async () => {
  const user = userEvent.setup()
  renderItems()
  expect(await screen.findByText("No items yet.")).toBeTruthy()
  const input = screen.getByRole("textbox", {
    name: "New item title",
  }) as HTMLInputElement
  await user.type(input, "Only once")
  let finishRefresh!: (items: typeof mock.records) => void
  mock.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRefresh = resolve
      }),
  )
  act(() => {
    fireEvent.submit(input.form!)
    fireEvent.submit(input.form!)
  })
  await waitFor(() => expect(mock.add).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(mock.load).toHaveBeenCalledTimes(2))
  expect(input.disabled).toBe(true)
  await act(async () => {
    finishRefresh(mock.records.map((item) => ({ ...item })))
  })
  expect(
    await screen.findByRole("textbox", { name: "Title for item 1" }),
  ).toBeTruthy()
  await waitFor(() => expect(input.disabled).toBe(false))
})
