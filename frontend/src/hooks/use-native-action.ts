import { useCallback, useEffect, useRef, useState } from "react"
import { DesktopError, desktopError, requireDesktop } from "@/lib/desktop"

export function useNativeAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DesktopError | null>(null)
  const mounted = useRef(false)
  const active = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      requireDesktop()
      if (active.current)
        throw new DesktopError(
          "busy",
          "Wait for the current native action to finish.",
        )
    } catch (cause) {
      const failure = desktopError(cause)
      if (mounted.current) setError(failure)
      throw failure
    }
    active.current = true
    if (mounted.current) {
      setBusy(true)
      setError(null)
    }
    try {
      return await action()
    } catch (cause) {
      const failure = desktopError(cause)
      if (mounted.current) setError(failure)
      throw failure
    } finally {
      active.current = false
      if (mounted.current) setBusy(false)
    }
  }, [])
  return { busy, error, run }
}
