import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { Monitor, Moon, Sun, Languages } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { ErrorNotice } from "@/components/error-notice"
import { createCommandRegistry, type AppCommand } from "@/lib/commands"
import { appRoutes } from "@/lib/routes"
import { useAppSettings } from "@/hooks/use-app-settings"

const CommandContext = createContext<{
  registry: ReturnType<typeof createCommandRegistry>
  openPalette: () => void
} | null>(null)

export function useCommandPalette() {
  const context = useContext(CommandContext)
  if (!context) throw new Error("CommandProvider is required")
  return {
    openPalette: context.openPalette,
    registerCommand: context.registry.register,
  }
}

// Memoize the array at the call site; cleanup handles Strict Mode and unmount.
export function useCommands(commands: AppCommand[]) {
  const { registerCommand } = useCommandPalette()
  useEffect(() => {
    const cleanups: (() => void)[] = []
    try {
      commands.forEach((command) => cleanups.push(registerCommand(command)))
    } catch (error) {
      cleanups.reverse().forEach((cleanup) => cleanup())
      throw error
    }
    return () => cleanups.reverse().forEach((cleanup) => cleanup())
  }, [commands, registerCommand])
}

function BuiltinCommands() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updateSettings } = useAppSettings()
  const commands = useMemo<AppCommand[]>(
    () => [
      ...Object.entries(appRoutes).map(([id, route]) => ({
        id: `navigate.${id}`,
        group: t("commands.navigation"),
        label: t(route.label),
        icon: route.icon,
        keywords: [
          "navigation",
          ...(id === "overview"
            ? ["overview", "Übersicht"]
            : ["settings", "Einstellungen"]),
        ],
        run: () => {
          void navigate(route.path)
        },
      })),
      ...(
        [
          { value: "light", icon: Sun },
          { value: "dark", icon: Moon },
          { value: "system", icon: Monitor },
        ] as const
      ).map(({ value, icon }) => ({
        id: `theme.${value}`,
        group: t("settings.appearance"),
        label: t(`settings.themes.${value}`),
        icon,
        keywords: [
          "theme",
          "appearance",
          "Darstellung",
          value,
          { light: "hell", dark: "dunkel", system: "system" }[value],
        ],
        run: async () => {
          await updateSettings({ theme: value })
        },
      })),
      ...(["en", "de"] as const).map((language) => ({
        id: `language.${language}`,
        group: t("settings.language"),
        label: language === "en" ? "English" : "Deutsch",
        icon: Languages,
        keywords: [
          "language",
          "Sprache",
          language === "en" ? "Englisch" : "German",
        ],
        run: async () => {
          await updateSettings({ language })
        },
      })),
    ],
    [navigate, t, updateSettings],
  )
  useCommands(commands)
  return null
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [registry] = useState(createCommandRegistry)
  const commands = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  )
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const executing = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const restoreFocus = useRef(true)
  const mounted = useRef(false)
  const openPalette = useMemo(
    () => () => {
      restoreFocus.current = true
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      setOpen(true)
    },
    [],
  )
  useEffect(() => {
    mounted.current = true
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey
      )
        return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (open) setOpen(false)
        else openPalette()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      mounted.current = false
      window.removeEventListener("keydown", onKey)
    }
  }, [open, openPalette])
  async function execute(id: string) {
    const command = registry.getSnapshot().find((item) => item.id === id)
    if (
      !command ||
      executing.current ||
      command.hidden?.() ||
      command.enabled?.() === false
    )
      return
    executing.current = true
    setBusy(id)
    setError(null)
    try {
      await command.run()
      if (mounted.current) {
        restoreFocus.current = command.restoreFocus !== false
        setOpen(false)
      }
    } catch (cause) {
      restoreFocus.current = true
      if (mounted.current)
        setError(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      executing.current = false
      if (mounted.current) setBusy(null)
    }
  }
  const groups = [
    ...new Set(
      commands
        .filter((command) => !command.hidden?.())
        .map((command) => command.group),
    ),
  ]
  return (
    <CommandContext.Provider value={{ registry, openPalette }}>
      <BuiltinCommands />
      {children}
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t("commands.title")}
        description={t("commands.description")}
        finalFocus={() =>
          !restoreFocus.current
            ? false
            : returnFocus.current?.isConnected
              ? returnFocus.current
              : document.querySelector<HTMLElement>("[data-command-launcher]")
        }
      >
        <Command label={t("commands.search")}>
          <CommandInput
            placeholder={t("commands.search")}
            aria-label={t("commands.search")}
          />
          <CommandList aria-busy={busy !== null}>
            <CommandEmpty>{t("commands.empty")}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group} heading={group}>
                {commands
                  .filter(
                    (command) => command.group === group && !command.hidden?.(),
                  )
                  .map((command) => {
                    const Icon = command.icon
                    const disabled =
                      busy !== null || command.enabled?.() === false
                    return (
                      <CommandItem
                        key={command.id}
                        value={command.id}
                        keywords={[
                          command.label,
                          command.group,
                          ...(command.keywords ?? []),
                        ]}
                        disabled={disabled}
                        title={disabled ? command.disabledReason : undefined}
                        onSelect={() => {
                          void execute(command.id)
                        }}
                      >
                        {Icon && <Icon aria-hidden="true" />}
                        {command.label}
                        {disabled && command.disabledReason && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {command.disabledReason}
                          </span>
                        )}
                        {command.shortcut && (
                          <CommandShortcut>{command.shortcut}</CommandShortcut>
                        )}
                      </CommandItem>
                    )
                  })}
              </CommandGroup>
            ))}
          </CommandList>
          {busy && (
            <p role="status" className="p-3 text-sm text-muted-foreground">
              {t("commands.running")}
            </p>
          )}
          <ErrorNotice error={error} />
        </Command>
      </CommandDialog>
    </CommandContext.Provider>
  )
}
