import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { HashRouter, Route, Routes } from "react-router"
import { AppLayout } from "@/components/app-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { HomePage } from "@/pages/home-page"
import { SettingsPage } from "@/pages/settings-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { AppSettingsProvider } from "@/components/app-settings-provider"
import { CommandProvider } from "@/components/command-palette"
import { appRoutes } from "@/lib/routes"
import { createQueryClient } from "@/lib/query-client"

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <ThemeProvider>
          <HashRouter>
            <CommandProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route
                    path={appRoutes.settings.path}
                    element={<SettingsPage />}
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </CommandProvider>
          </HashRouter>
        </ThemeProvider>
      </AppSettingsProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
