import { useMemo } from "react"
import { Dialogs } from "@wailsio/runtime"
import { useDesktop } from "@/hooks/use-desktop"
import { useNativeAction } from "@/hooks/use-native-action"

export type FileDialogOptions = Omit<
  Dialogs.OpenFileDialogOptions,
  "AllowsMultipleSelection" | "CanChooseDirectories" | "CanChooseFiles"
>
export type FileSelection =
  { status: "selected"; path: string } | { status: "cancelled" }
export type FilesSelection =
  { status: "selected"; paths: string[] } | { status: "cancelled" }
const selection = (path: string): FileSelection =>
  path ? { status: "selected", path } : { status: "cancelled" }

export function useFileDialog() {
  const available = useDesktop()
  const { busy, error, run } = useNativeAction()
  const actions = useMemo(
    () => ({
      openFile: (options: FileDialogOptions = {}) =>
        run(async () =>
          selection(
            await Dialogs.OpenFile({
              ...options,
              CanChooseFiles: true,
              CanChooseDirectories: false,
              AllowsMultipleSelection: false,
            }),
          ),
        ),
      openFiles: (options: FileDialogOptions = {}): Promise<FilesSelection> =>
        run(async () => {
          const paths = await Dialogs.OpenFile({
            ...options,
            CanChooseFiles: true,
            CanChooseDirectories: false,
            AllowsMultipleSelection: true,
          })
          return paths?.length
            ? { status: "selected", paths }
            : { status: "cancelled" }
        }),
      selectDirectory: (options: FileDialogOptions = {}) =>
        run(async () =>
          selection(
            await Dialogs.OpenFile({
              ...options,
              CanChooseFiles: false,
              CanChooseDirectories: true,
              AllowsMultipleSelection: false,
            }),
          ),
        ),
      saveFile: (options: Dialogs.SaveFileDialogOptions = {}) =>
        run(async () => selection(await Dialogs.SaveFile(options))),
    }),
    [run],
  )
  return { ...actions, available, busy, error }
}
