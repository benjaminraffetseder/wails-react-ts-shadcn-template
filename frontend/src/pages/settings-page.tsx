import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAppSettings } from "@/hooks/use-app-settings"
import { useDesktop } from "@/hooks/use-desktop"
import { useAppInfo } from "@/hooks/use-app-info"
import { ErrorNotice } from "@/components/error-notice"
import { initializeAppSettings, failNativeSettings } from "@/lib/app-settings"
import { DesktopError, waitForDesktop } from "@/lib/desktop"
import { languages } from "@/i18n"

const themes = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const

export function SettingsPage() {
  const { t } = useTranslation()
  const { settings, source, isSaving, error, updateSettings, resetSettings } =
    useAppSettings()
  const desktop = useDesktop()
  const info = useAppInfo()
  async function reloadSettings() {
    if (source !== "native") return initializeAppSettings(desktop, true)
    try {
      if (!(await waitForDesktop()))
        throw new DesktopError(
          "unavailable",
          "The native runtime is not ready. Restart the desktop app.",
        )
      await initializeAppSettings(true, true)
    } catch (failure) {
      await failNativeSettings(failure)
    }
  }
  // Errors are shared in the application shell; consume rejection at UI actions.
  const save = (operation: Promise<unknown>) => {
    void operation.catch(() => undefined)
  }
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("nav.settings")}
      </h1>
      <p className="text-sm text-muted-foreground" role="status">
        {isSaving
          ? t("settings.saving")
          : source === "native"
            ? t("settings.native")
            : t("settings.preview")}
      </p>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            value={[settings.theme]}
            disabled={isSaving}
            aria-label={t("settings.themeLabel")}
            variant="outline"
            onValueChange={(values) => {
              const theme = themes.find(
                ({ value }) => value === values[0],
              )?.value
              if (theme) save(updateSettings({ theme }))
            }}
          >
            {themes.map(({ value, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value}>
                <Icon aria-hidden="true" />
                {t(`settings.themes.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            value={[settings.language]}
            disabled={isSaving}
            aria-label={t("settings.language")}
            variant="outline"
            onValueChange={(values) => {
              const language = languages.find(
                ({ code }) => code === values[0],
              )?.code
              if (language) save(updateSettings({ language }))
            }}
          >
            {languages.map(({ code, label }) => (
              <ToggleGroupItem key={code} value={code}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.storage")}</CardTitle>
          <CardDescription>{t("settings.storageHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={isSaving}
            onClick={() => save(resetSettings())}
          >
            {t("settings.reset")}
          </Button>
          {error && (
            <Button
              variant="outline"
              disabled={isSaving}
              onClick={() => {
                void reloadSettings()
              }}
            >
              {t("common.retry")}
            </Button>
          )}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.about")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            {t("settings.version", {
              version: info.error
                ? t("common.unavailable")
                : (info.version ?? t("common.loading")),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {info.source === "native"
              ? t("settings.embeddedVersion")
              : t("settings.packageVersion")}
          </p>
          <ErrorNotice error={info.error} />
        </CardContent>
      </Card>
    </div>
  )
}
