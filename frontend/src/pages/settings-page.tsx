import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/components/theme-provider"
import { useTranslation } from "react-i18next"
import { languages } from "@/i18n"

const themes = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("nav.settings")}
      </h1>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.appearance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-wrap gap-3"
            role="group"
            aria-label={t("settings.themeLabel")}
          >
            {themes.map(({ value, icon: Icon }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                className="min-w-28"
              >
                <Icon className="size-4" aria-hidden="true" />
                {t(`settings.themes.${value}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-wrap gap-3"
            role="group"
            aria-label={t("settings.language")}
          >
            {languages.map(({ code, label }) => (
              <Button
                key={code}
                variant={i18n.resolvedLanguage === code ? "default" : "outline"}
                aria-pressed={i18n.resolvedLanguage === code}
                onClick={() => {
                  void i18n.changeLanguage(code)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
