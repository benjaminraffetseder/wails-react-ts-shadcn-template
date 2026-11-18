import { useMemo } from "react"
import { Window } from "@wailsio/runtime"
import { useDesktop } from "@/hooks/use-desktop"
import { useNativeAction } from "@/hooks/use-native-action"

export function useAppWindow() {
  const available = useDesktop()
  const { busy, error, run } = useNativeAction()
  // Wails' Window export targets the calling window. Resolve the action each
  // time; do not cache a named window or a reference obtained at mount time.
  const actions = useMemo(
    () => ({
      minimize: () => run(() => Window.Minimise()),
      maximize: () => run(() => Window.Maximise()),
      restore: () => run(() => Window.UnMaximise()),
      toggleMaximize: () => run(() => Window.ToggleMaximise()),
      close: () => run(() => Window.Close()),
    }),
    [run],
  )
  return { ...actions, available, busy, error }
}
