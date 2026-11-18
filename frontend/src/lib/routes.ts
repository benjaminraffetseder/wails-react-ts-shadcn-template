import { House, Settings2 } from "lucide-react"

export const appRoutes = {
  overview: { path: "/", label: "nav.overview", icon: House },
  settings: { path: "/settings", label: "nav.settings", icon: Settings2 },
} as const
