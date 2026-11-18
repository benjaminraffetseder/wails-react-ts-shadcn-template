import { ArrowRight } from "lucide-react"
import { Link } from "react-router"
import { useTranslation } from "react-i18next"
import { buttonVariants } from "@/components/ui/button"
import { DesktopDemo } from "@/components/desktop-demo"
import { ItemsDemo } from "@/components/items-demo"

export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("nav.overview")}
      </h1>
      <DesktopDemo />
      <ItemsDemo />
      <Link
        to="/settings"
        className={buttonVariants({
          variant: "outline",
          className: "self-start",
        })}
      >
        {t("settings.appearance")}
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </div>
  )
}
