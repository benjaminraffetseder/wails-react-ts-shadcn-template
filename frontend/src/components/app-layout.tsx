import { Blocks, Search } from "lucide-react"
import { NavLink, Outlet } from "react-router"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useDesktop } from "@/hooks/use-desktop"
import { Button } from "@/components/ui/button"
import { useCommandPalette } from "@/components/command-palette"
import { appRoutes } from "@/lib/routes"
import { useAppSettings } from "@/hooks/use-app-settings"
import { ErrorNotice } from "@/components/error-notice"
import { WindowTitlebar } from "@/components/window-titlebar"

export function AppLayout({
  customTitlebar = false,
}: {
  customTitlebar?: boolean
}) {
  const { t } = useTranslation()
  const isDesktop = useDesktop()
  const { openPalette } = useCommandPalette()
  const { error } = useAppSettings()
  return (
    <div className="flex min-h-screen flex-col">
      {customTitlebar && <WindowTitlebar />}
      <div className="flex flex-1">
        <aside className="flex w-48 shrink-0 flex-col border-r bg-sidebar p-4 md:w-56">
          {!customTitlebar && (
            <>
              <div className="flex items-center gap-3 px-2 py-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Blocks className="size-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold">{t("app.title")}</p>
              </div>
              <Separator className="my-4" />
            </>
          )}
          <Button variant="outline" onClick={openPalette} data-command-launcher>
            <Search data-icon="inline-start" aria-hidden="true" />
            {t("commands.launcher")}
          </Button>
          <nav aria-label={t("nav.label")} className="mt-3 flex flex-col gap-1">
            {Object.values(appRoutes).map(({ path: to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(label)}
              </NavLink>
            ))}
          </nav>
          {!isDesktop && (
            <div className="mt-auto px-2 pt-12">
              <Badge variant="outline">{t("app.browserPreview")}</Badge>
            </div>
          )}
        </aside>
        <main id="main-content" className="min-w-0 flex-1 p-6 md:p-10">
          <div className="mx-auto max-w-4xl">
            <ErrorNotice error={error} />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
