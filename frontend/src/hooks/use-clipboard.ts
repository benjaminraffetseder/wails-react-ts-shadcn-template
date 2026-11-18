import { useMemo } from "react"
import { Clipboard } from "@wailsio/runtime"
import { useDesktop } from "@/hooks/use-desktop"
import { useNativeAction } from "@/hooks/use-native-action"
import { DesktopError } from "@/lib/desktop"

export function useClipboard() {
  const available = useDesktop()
  const { busy, error, run } = useNativeAction()
  const canRead = available && typeof Clipboard.Text === "function"
  const actions = useMemo(
    () => ({
      writeText: (text: string) => run(() => Clipboard.SetText(text)),
      readText: () =>
        run(() => {
          if (typeof Clipboard.Text !== "function")
            throw new DesktopError(
              "unsupported",
              "Clipboard reading is unavailable in this Wails runtime.",
            )
          return Clipboard.Text()
        }),
    }),
    [run],
  )
  return { ...actions, available, canRead, busy, error }
}
