import { useCallback } from "react"
import { useDesktop } from "@/hooks/use-desktop"
import { useNativeAction } from "@/hooks/use-native-action"

export type NotificationOptions = {
  title: string
  body?: string
  id?: string
  silent?: boolean
}
export function useNotification() {
  const available = useDesktop()
  const { busy, error, run } = useNativeAction()
  const notify = useCallback(
    (options: NotificationOptions) =>
      run(async () => {
        const { Notify } = await import("@wails/desktopnotifications")
        await Notify({
          id: options.id ?? crypto.randomUUID(),
          title: options.title,
          body: options.body ?? "",
          silent: options.silent ?? false,
        })
      }),
    [run],
  )
  return { notify, available, busy, error }
}
