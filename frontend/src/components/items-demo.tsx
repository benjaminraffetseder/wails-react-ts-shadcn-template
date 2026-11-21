import { useRef, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { useItems, type Item, type ItemChange } from "@/hooks/use-items"
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
  const { available: enabled, query, change: mutation } = useItems()
  const items = query.data ?? []
  const [title, setTitle] = useState("")
  const busy = mutation.isPending || query.isFetching
  const loading = query.isPending
  const error = mutation.error ?? query.error
  const working = useRef(false)
  function change(action: ItemChange) {
    if (!enabled || working.current || busy) return
    working.current = true
    mutation.mutate(action, {
      onSuccess: () => {
        if (action.kind === "add") setTitle("")
      },
      onSettled: () => {
        working.current = false
      },
    })
  }
  function add(event: FormEvent) {
    event.preventDefault()
    change({ kind: "add", title })
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
                      change({ kind: "update", id, title: value, done })
                    }}
                    remove={(id) => {
                      change({ kind: "delete", id })
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
                  mutation.reset()
                  void query.refetch()
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
