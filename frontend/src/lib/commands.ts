import type { LucideIcon } from "lucide-react"

export type AppCommand = {
  id: string
  group: string
  label: string
  keywords?: string[]
  shortcut?: string
  icon?: LucideIcon
  enabled?: () => boolean
  hidden?: () => boolean
  disabledReason?: string
  // Set false when the command moves focus into its own editor or dialog.
  restoreFocus?: boolean
  run: () => void | Promise<void>
}

export function createCommandRegistry() {
  let commands: AppCommand[] = []
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    getSnapshot: () => commands,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    register(command: AppCommand) {
      if (commands.some(({ id }) => id === command.id))
        throw new Error(`Duplicate command ID: ${command.id}`)
      commands = [...commands, command]
      emit()
      return () => {
        commands = commands.filter((item) => item !== command)
        emit()
      }
    },
  }
}
