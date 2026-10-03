import { Link } from "react-router"
import { buttonVariants } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <Link to="/" className={buttonVariants()}>
        {t("notFound.back")}
      </Link>
    </div>
  )
}
