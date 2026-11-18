import { StrictMode } from "react"
import { act, renderHook } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"
import { useFileDialog } from "@/hooks/use-file-dialog"
import { useClipboard } from "@/hooks/use-clipboard"
import { useAppWindow } from "@/hooks/use-app-window"
import { useNotification } from "@/hooks/use-notification"
import { useWailsEvent } from "@/hooks/use-wails-event"
import { useDesktop } from "@/hooks/use-desktop"
import { waitForDesktop } from "@/lib/desktop"

const mock = vi.hoisted(() => ({
  native: true,
  open: vi.fn(),
  save: vi.fn(),
  write: vi.fn(),
  read: vi.fn(),
  notify: vi.fn(),
  minimize: vi.fn(),
  toggle: vi.fn(),
  close: vi.fn(),
  listeners: new Map<
    string,
    Set<(event: { name: string; data: unknown }) => void>
  >(),
}))
vi.mock("@wailsio/runtime", () => ({
  System: { IsDesktop: () => mock.native },
  Dialogs: { OpenFile: mock.open, SaveFile: mock.save },
  Clipboard: { SetText: mock.write, Text: mock.read },
  Window: {
    Minimise: mock.minimize,
    Maximise: vi.fn(),
    UnMaximise: vi.fn(),
    ToggleMaximise: mock.toggle,
    Close: mock.close,
  },
  Events: {
    On: (
      name: string,
      callback: (event: { name: string; data: unknown }) => void,
    ) => {
      const listeners = mock.listeners.get(name) ?? new Set()
      listeners.add(callback)
      mock.listeners.set(name, listeners)
      return () => listeners.delete(callback)
    },
  },
}))
vi.mock("@wails/desktopnotifications", () => ({ Notify: mock.notify }))

beforeEach(() => {
  mock.native = true
  mock.listeners.clear()
  vi.clearAllMocks()
})

it("waits for delayed native configuration before choosing an adapter", async () => {
  mock.native = false
  const original = Object.getOwnPropertyDescriptor(window, "chrome")
  Object.defineProperty(window, "chrome", {
    configurable: true,
    value: { webview: {} },
  })
  try {
    const ready = waitForDesktop()
    mock.native = true
    window.dispatchEvent(new Event("wails:runtime-config-ready"))
    await expect(ready).resolves.toBe(true)
  } finally {
    if (original) Object.defineProperty(window, "chrome", original)
    else Reflect.deleteProperty(window, "chrome")
  }
})

it("distinguishes selected files, cancellation and unexpected errors", async () => {
  const { result } = renderHook(() => useFileDialog())
  mock.open
    .mockResolvedValueOnce("/image.png")
    .mockResolvedValueOnce("")
    .mockResolvedValueOnce(["/a", "/b"])
    .mockResolvedValueOnce("/folder")
  await act(async () => {
    expect(
      await result.current.openFile({
        Filters: [{ DisplayName: "Images", Pattern: "*.png;*.jpg" }],
      }),
    ).toEqual({ status: "selected", path: "/image.png" })
    expect(await result.current.openFile()).toEqual({ status: "cancelled" })
    expect(await result.current.openFiles()).toEqual({
      status: "selected",
      paths: ["/a", "/b"],
    })
    expect(await result.current.selectDirectory()).toEqual({
      status: "selected",
      path: "/folder",
    })
  })
  expect(mock.open).toHaveBeenNthCalledWith(
    4,
    expect.objectContaining({
      CanChooseFiles: false,
      CanChooseDirectories: true,
      AllowsMultipleSelection: false,
    }),
  )
  mock.save.mockResolvedValue("")
  await act(async () => {
    expect(await result.current.saveFile()).toEqual({ status: "cancelled" })
  })
  mock.open.mockRejectedValueOnce(new Error("dialog failed"))
  await act(async () => {
    await expect(result.current.openFile()).rejects.toMatchObject({
      code: "operation",
    })
  })
  expect(result.current.busy).toBe(false)
})

it("guards preview calls and responds to late runtime readiness", async () => {
  mock.native = false
  const { result } = renderHook(() => ({
    files: useFileDialog(),
    clipboard: useClipboard(),
    window: useAppWindow(),
    notification: useNotification(),
  }))
  await act(async () => {
    await expect(result.current.files.openFile()).rejects.toMatchObject({
      code: "unavailable",
    })
    await expect(result.current.clipboard.writeText("x")).rejects.toMatchObject(
      { code: "unavailable" },
    )
    await expect(result.current.window.close()).rejects.toMatchObject({
      code: "unavailable",
    })
    await expect(
      result.current.notification.notify({ title: "Test" }),
    ).rejects.toMatchObject({ code: "unavailable" })
  })
  expect(mock.open).not.toHaveBeenCalled()
  expect(mock.write).not.toHaveBeenCalled()
  expect(mock.close).not.toHaveBeenCalled()
  expect(mock.notify).not.toHaveBeenCalled()
  act(() => {
    mock.native = true
    window.dispatchEvent(new Event("wails:runtime-config-ready"))
  })
  expect(result.current.files.available).toBe(true)
})

it("supports clipboard/window/notifications and reports permission errors", async () => {
  const { result } = renderHook(() => ({
    clipboard: useClipboard(),
    window: useAppWindow(),
    notification: useNotification(),
  }))
  mock.read.mockResolvedValue("hello")
  await act(async () => {
    await result.current.clipboard.writeText("hello")
    expect(await result.current.clipboard.readText()).toBe("hello")
    await result.current.window.minimize()
    await result.current.window.toggleMaximize()
    await result.current.notification.notify({
      title: "Hi",
      body: "Body",
      id: "test",
    })
  })
  expect(mock.write).toHaveBeenCalledWith("hello")
  expect(mock.minimize).toHaveBeenCalledOnce()
  expect(mock.toggle).toHaveBeenCalledOnce()
  expect(mock.notify).toHaveBeenCalledWith({
    id: "test",
    title: "Hi",
    body: "Body",
    silent: false,
  })
  mock.read.mockRejectedValueOnce(new Error("permission denied"))
  await act(async () => {
    await expect(result.current.clipboard.readText()).rejects.toMatchObject({
      code: "permission",
    })
  })
})

it("does not duplicate Strict Mode listeners and cleans up on changes/unmount", () => {
  const callback = vi.fn()
  const { rerender, unmount } = renderHook(
    ({ name }) => useWailsEvent(name, callback),
    { initialProps: { name: "one" }, wrapper: StrictMode },
  )
  expect(mock.listeners.get("one")?.size).toBe(1)
  act(() => {
    mock.listeners
      .get("one")
      ?.forEach((listener) => listener({ name: "one", data: 42 }))
  })
  expect(callback).toHaveBeenCalledOnce()
  rerender({ name: "two" })
  expect(mock.listeners.get("one")?.size).toBe(0)
  expect(mock.listeners.get("two")?.size).toBe(1)
  unmount()
  expect(mock.listeners.get("two")?.size).toBe(0)
})

it("never calls native APIs during server rendering", () => {
  function ServerExample() {
    const desktop = useDesktop()
    const files = useFileDialog()
    return <span>{String(desktop || files.available)}</span>
  }
  expect(renderToString(<ServerExample />)).toContain("false")
  expect(mock.open).not.toHaveBeenCalled()
})
