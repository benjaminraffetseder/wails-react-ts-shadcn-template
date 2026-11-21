import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { GetItems, AddItem, UpdateItem, DeleteItem } from "@wails/itemsservice"
import { useDesktop } from "@/hooks/use-desktop"
import { DesktopError } from "@/lib/desktop"
import { localQueryOptions } from "@/lib/query-client"

export type Item = Awaited<ReturnType<typeof GetItems>>[number]
export type ItemChange =
  | { kind: "add"; title: string }
  | { kind: "update"; id: number; title: string; done: boolean }
  | { kind: "delete"; id: number }

export const itemsQueryKey = ["items"] as const

export function useItems() {
  const available = useDesktop()
  const queryClient = useQueryClient()
  const query = useQuery({
    ...localQueryOptions,
    queryKey: itemsQueryKey,
    queryFn: () => GetItems(),
    enabled: available,
  })
  const change = useMutation({
    ...localQueryOptions,
    mutationKey: itemsQueryKey,
    mutationFn: async (action: ItemChange) => {
      if (!available)
        throw new DesktopError(
          "unavailable",
          "Run this action in the Wails desktop app.",
        )
      switch (action.kind) {
        case "add":
          return AddItem(action.title)
        case "update":
          return UpdateItem(action.id, action.title, action.done)
        case "delete":
          return DeleteItem(action.id)
      }
    },
    // Keep the mutation pending until the list has refreshed. A failed read is
    // exposed by the query and can be retried without repeating the write.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsQueryKey }),
  })
  return { available, query, change }
}
