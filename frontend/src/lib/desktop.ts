import { System } from "@wailsio/runtime"

export function isDesktop() {
  return typeof window !== "undefined" && System.IsDesktop()
}

// Windows may inject runtime configuration after the initial JS modules. Wait
// for that configuration when a native bridge is already present, never start
// with the browser adapter and accidentally save native preferences locally.
export async function waitForDesktop(): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (isDesktop()) return true
  const host = window as Window & {
    chrome?: { webview?: unknown }
    webkit?: { messageHandlers?: { external?: unknown } }
  }
  if (!host.chrome?.webview && !host.webkit?.messageHandlers?.external)
    return false
  return new Promise((resolve, reject) => {
    const ready = () => {
      if (!isDesktop()) return
      cleanup()
      resolve(true)
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(
        new Error(
          "desktop:unavailable: native runtime configuration did not arrive",
        ),
      )
    }, 10000)
    const cleanup = () => {
      clearTimeout(timeout)
      window.removeEventListener("wails:runtime-config-ready", ready)
    }
    window.addEventListener("wails:runtime-config-ready", ready)
    ready()
  })
}

export type DesktopErrorCode =
  "unavailable" | "unsupported" | "permission" | "busy" | "operation"
export class DesktopError extends Error {
  constructor(
    public code: DesktopErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "DesktopError"
  }
}

export function requireDesktop() {
  if (!isDesktop())
    throw new DesktopError(
      "unavailable",
      "Run this action in the Wails desktop app.",
    )
}

export function desktopError(cause: unknown): DesktopError {
  if (cause instanceof DesktopError) return cause
  const message = cause instanceof Error ? cause.message : String(cause)
  const code = /desktop:permission|permission|denied|notallowed/i.test(message)
    ? "permission"
    : /desktop:unsupported|not supported|unavailable on/i.test(message)
      ? "unsupported"
      : "operation"
  return new DesktopError(code, message, { cause })
}
