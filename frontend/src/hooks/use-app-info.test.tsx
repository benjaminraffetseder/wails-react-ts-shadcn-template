import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { version } from "../../package.json"
import "@/i18n"
import { useAppInfo } from "@/hooks/use-app-info"

const mock = vi.hoisted(() => ({ desktop: true, getInfo: vi.fn() }))
vi.mock("@/hooks/use-desktop", () => ({ useDesktop: () => mock.desktop }))
vi.mock("@wails/internal/app/app", () => ({ GetInfo: mock.getInfo }))

beforeEach(() => {
  mock.desktop = true
  mock.getInfo.mockReset()
})

it("does not label the package version as a loaded native version", async () => {
  let complete: (value: { version: string }) => void = () => undefined
  mock.getInfo.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const { result } = renderHook(() => useAppInfo())
  expect(result.current.version).toBeNull()
  expect(result.current.isLoading).toBe(true)
  await waitFor(() => expect(mock.getInfo).toHaveBeenCalledOnce())
  complete({ version: "9.8.7" })
  await waitFor(() => expect(result.current.version).toBe("9.8.7"))
  expect(result.current.isLoading).toBe(false)
})

it("exposes native metadata failures without using a package version fallback", async () => {
  mock.getInfo.mockRejectedValue(new Error("native metadata unavailable"))
  const { result } = renderHook(() => useAppInfo())
  await waitFor(() =>
    expect(result.current.error?.message).toBe("native metadata unavailable"),
  )
  expect(result.current.version).toBeNull()
  expect(result.current.isLoading).toBe(false)
})

it("uses the package version only in browser preview", () => {
  mock.desktop = false
  const { result } = renderHook(() => useAppInfo())
  expect(result.current).toMatchObject({
    source: "preview",
    version,
    isLoading: false,
  })
  expect(mock.getInfo).not.toHaveBeenCalled()
})
