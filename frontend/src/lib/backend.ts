import { Greet } from "@wails/go/main/App"

// Vite can preview the UI without Wails; native methods are available in wails dev/build.
export const isDesktop = typeof window !== "undefined" && "go" in window

export type Greeting = Awaited<ReturnType<typeof Greet>>

export async function greet(name: string): Promise<Greeting> {
  if (!isDesktop)
    throw new Error("Run this app with wails dev to connect to Go.")
  return Greet(name)
}
