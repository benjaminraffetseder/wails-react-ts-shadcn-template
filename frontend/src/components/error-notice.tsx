import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DesktopError } from "@/lib/desktop"

export function ErrorNotice({ error }: { error: Error | null }) {
  const { t } = useTranslation()
  if (!error) return null
  const code = error instanceof DesktopError ? error.code : "operation"
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("common.error")}</AlertTitle>
      <AlertDescription>
        <p>{t(`errors.${code}`)}</p>
        <details>
          <summary>{t("common.details")}</summary>
          <p className="break-all">{error.message}</p>
        </details>
      </AlertDescription>
    </Alert>
  )
}
