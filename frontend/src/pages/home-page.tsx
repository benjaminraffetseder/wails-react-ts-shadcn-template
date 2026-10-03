import { useState, type FormEvent } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
import { Link } from "react-router"
import { Trans, useTranslation } from "react-i18next"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { greet, isDesktop, type Greeting } from "@/lib/backend"
import { cn } from "@/lib/utils"

export function HomePage() {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [result, setResult] = useState<Greeting | null>(null)
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleGreeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setResult(null)
    setError(false)
    try {
      setResult(await greet(name))
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("nav.overview")}
      </h1>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>{t("greeting.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGreeting} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="greeting-name">{t("greeting.name")}</Label>
              <div className="flex max-w-lg gap-2">
                <Input
                  id="greeting-name"
                  placeholder="Ada"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={pending || !isDesktop}
                />
                <Button type="submit" disabled={pending || !isDesktop}>
                  {pending ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                  {pending ? t("greeting.pending") : t("greeting.submit")}
                </Button>
              </div>
            </div>
            <div aria-live="polite" role="status">
              {result && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  {result.name
                    ? t("greeting.result", { name: result.name })
                    : t("greeting.emptyResult")}
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive">
                  {t("greeting.error")}
                </p>
              )}
              {!isDesktop && (
                <p className="text-xs text-muted-foreground">
                  <Trans
                    i18nKey="greeting.previewHint"
                    components={{ command: <code /> }}
                  />
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/settings"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          {t("settings.appearance")}{" "}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Dialog>
          <DialogTrigger render={<Button variant="ghost" />}>
            {t("dialog.open")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialog.title")}</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
