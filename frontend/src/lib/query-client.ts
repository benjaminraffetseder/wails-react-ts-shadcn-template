import { QueryClient } from "@tanstack/react-query"

// Native bindings work without internet access. Apply this only to local data;
// HTTP queries and mutations should keep their network-aware defaults.
export const localQueryOptions = {
  networkMode: "always",
  retry: false,
} as const

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  })
}
