import { Blocks, Maximize2, Minus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { ErrorNotice } from "@/components/error-notice"
import { useAppWindow } from "@/hooks/use-app-window"

// Pair with Frameless: true in the native window options. Close uses the normal
// window lifecycle; applications can install their own native close hook.
export function WindowTitlebar() {
  const { t } = useTranslation()
  const window = useAppWindow()
  const act = (action: () => Promise<unknown>) => {
    void action().catch(() => undefined)
  }
  return (
    <>
      <header
        className="window-titlebar sticky top-0 z-10 flex h-10 shrink-0 select-none items-center justify-between border-b bg-background px-2"
        aria-label={t("window.titlebar")}
      >
        <div className="flex items-center gap-2 px-2 text-sm font-medium">
          <Blocks className="size-4" aria-hidden="true" />
          <span>{t("app.title")}</span>
        </div>
        <div className="window-controls flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!window.available || window.busy}
            aria-label={t("desktop.minimize")}
            title={t("desktop.minimize")}
            onClick={() => act(window.minimize)}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!window.available || window.busy}
            aria-label={t("desktop.maximize")}
            title={t("desktop.maximize")}
            onClick={() => act(window.toggleMaximize)}
          >
            <Maximize2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!window.available || window.busy}
            aria-label={t("common.close")}
            title={t("common.close")}
            onClick={() => act(window.close)}
          >
            <X />
          </Button>
        </div>
      </header>
      <ErrorNotice error={window.error} />
    </>
  )
}
