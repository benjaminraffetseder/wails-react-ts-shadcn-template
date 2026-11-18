import { useEffect, useState } from "react"
import { useDesktop } from "@/hooks/use-desktop"
import { version } from "../../package.json"

export function useAppInfo() {
  const desktop = useDesktop()
  const [info, setInfo] = useState<{
    version: string
  } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    if (!desktop) return
    let cancelled = false
    void import("@wails/app")
      .then(async ({ GetInfo }) => {
        if (cancelled) return
        const result = await GetInfo()
        if (!cancelled) setInfo(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
    return () => {
      cancelled = true
    }
  }, [desktop])
  return desktop
    ? {
        version: info?.version ?? null,
        error,
        source: "native" as const,
        isLoading: !info && !error,
      }
    : {
        version,
        error: null,
        source: "preview" as const,
        isLoading: false,
      }
}
