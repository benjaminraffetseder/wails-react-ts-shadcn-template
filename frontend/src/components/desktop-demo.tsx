import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { ErrorNotice } from "@/components/error-notice"
import { useFileDialog } from "@/hooks/use-file-dialog"
import { useClipboard } from "@/hooks/use-clipboard"
import { useAppWindow } from "@/hooks/use-app-window"
import { useNotification } from "@/hooks/use-notification"
import { desktopError } from "@/lib/desktop"

export function DesktopDemo() {
  const { t } = useTranslation()
  const files = useFileDialog()
  const clipboard = useClipboard()
  const appWindow = useAppWindow()
  const notifications = useNotification()
  const [text, setText] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const busy =
    files.busy || clipboard.busy || appWindow.busy || notifications.busy
  async function perform(action: () => Promise<void>) {
    setError(null)
    setMessage("")
    try {
      await action()
    } catch (cause) {
      setError(desktopError(cause))
    }
  }
  async function select(
    kind: "openFile" | "openFiles" | "selectDirectory" | "saveFile",
  ) {
    const result = await files[kind]()
    if (result.status === "cancelled") {
      setMessage(t("desktop.cancelled"))
      return
    }
    const paths = "paths" in result ? result.paths.join("\n") : result.path
    setText(paths)
    setMessage(t("desktop.selected"))
  }
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{t("desktop.title")}</CardTitle>
        <CardDescription>
          {files.available ? t("desktop.description") : t("desktop.preview")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(
            ["openFile", "openFiles", "selectDirectory", "saveFile"] as const
          ).map((kind) => (
            <Button
              key={kind}
              variant="outline"
              disabled={!files.available || busy}
              onClick={() => {
                void perform(() => select(kind))
              }}
            >
              {t(`desktop.${kind}`)}
            </Button>
          ))}
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="clipboard-text">
              {t("desktop.clipboardText")}
            </FieldLabel>
            <Input
              id="clipboard-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!clipboard.available || busy}
            onClick={() => {
              void perform(async () => {
                await clipboard.writeText(text)
                setMessage(t("desktop.copied"))
              })
            }}
          >
            {t("desktop.copy")}
          </Button>
          <Button
            variant="outline"
            disabled={!clipboard.canRead || busy}
            onClick={() => {
              void perform(async () => {
                setText(await clipboard.readText())
                setMessage(t("desktop.read"))
              })
            }}
          >
            {t("desktop.readClipboard")}
          </Button>
          <Button
            variant="outline"
            disabled={!appWindow.available || busy}
            onClick={() => {
              void perform(appWindow.minimize)
            }}
          >
            {t("desktop.minimize")}
          </Button>
          <Button
            variant="outline"
            disabled={!appWindow.available || busy}
            onClick={() => {
              void perform(appWindow.toggleMaximize)
            }}
          >
            {t("desktop.maximize")}
          </Button>
          <Button
            variant="outline"
            disabled={!notifications.available || busy}
            onClick={() => {
              void perform(async () => {
                await notifications.notify({
                  title: t("desktop.notificationTitle"),
                  body: t("desktop.notificationBody"),
                })
                setMessage(t("desktop.notified"))
              })
            }}
          >
            {t("desktop.notify")}
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {busy ? t("common.loading") : message}
        </p>
        <ErrorNotice error={error} />
      </CardContent>
    </Card>
  )
}
