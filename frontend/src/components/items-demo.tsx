import { useEffect, useRef, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { GetItems, AddItem, UpdateItem, DeleteItem } from "@wails/itemsservice"
import { useDesktop } from "@/hooks/use-desktop"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ErrorNotice } from "@/components/error-notice"

type Item = Awaited<ReturnType<typeof GetItems>>[number]

function ItemRow({
  item,
  busy,
  update,
  remove,
}: {
  item: Item
  busy: boolean
  update: (id: number, title: string, done: boolean) => void
  remove: (id: number) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(item.title)
  return (
    <li>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          update(item.id, title, item.done)
        }}
      >
        <Field className="min-w-40 flex-1">
          <FieldLabel htmlFor={`item-${item.id}`}>
            {t("items.itemTitle", { id: item.id })}
          </FieldLabel>
          <Input
            id={`item-${item.id}`}
            maxLength={200}
            value={title}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Button
          type="submit"
          variant="outline"
          disabled={busy || !title.trim()}
        >
          {t("items.save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          aria-pressed={item.done}
          onClick={() => update(item.id, item.title, !item.done)}
        >
          {item.done ? t("items.completed") : t("items.complete")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => remove(item.id)}
        >
          {t("items.delete")}
        </Button>
      </form>
    </li>
  )
}

export function ItemsDemo() {
  const { t } = useTranslation()
  const enabled = useDesktop()
  const [items, setItems] = useState<Item[]>([])
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mounted = useRef(false)
  const working = useRef(false)
  useEffect(() => {
    mounted.current = true
    if (!enabled)
      return () => {
        mounted.current = false
      }
    let cancelled = false
    void GetItems()
      .then((result) => {
        if (!cancelled) setItems(result)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [enabled])
  async function change(action: () => Promise<unknown>) {
    if (!enabled || working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      const result = await GetItems()
      if (mounted.current) setItems(result)
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      working.current = false
      if (mounted.current) {
        setBusy(false)
        setLoading(false)
      }
    }
  }
  function add(event: FormEvent) {
    event.preventDefault()
    void change(async () => {
      await AddItem(title)
      if (mounted.current) setTitle("")
    })
  }
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{t("items.title")}</CardTitle>
        <CardDescription>
          {enabled ? t("items.description") : t("items.preview")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {enabled && (
          <>
            <form onSubmit={add} className="flex items-end gap-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-item">
                    {t("items.newTitle")}
                  </FieldLabel>
                  <Input
                    id="new-item"
                    value={title}
                    maxLength={200}
                    disabled={busy || loading}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
              </FieldGroup>
              <Button type="submit" disabled={busy || loading || !title.trim()}>
                {t("items.add")}
              </Button>
            </form>
            {loading ? (
              <p role="status">{t("common.loading")}</p>
            ) : items.length ? (
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    busy={busy}
                    update={(id, value, done) => {
                      void change(() => UpdateItem(id, value, done))
                    }}
                    remove={(id) => {
                      void change(() => DeleteItem(id))
                    }}
                  />
                ))}
              </ul>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("items.empty")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            <ErrorNotice error={error} />
            {error && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void change(async () => undefined)
                }}
              >
                {t("common.retry")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
