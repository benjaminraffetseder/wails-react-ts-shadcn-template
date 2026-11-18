import { useEffect, useEffectEvent } from "react"
import { Events } from "@wailsio/runtime"
import { useDesktop } from "@/hooks/use-desktop"

// application.RegisterEvent[Payload] in Go generates typed custom event bindings.
export function useWailsEvent<E extends Events.WailsEventName>(
  name: E,
  callback: Events.WailsEventCallback<E>,
  enabled = true,
) {
  const desktop = useDesktop()
  const onEvent = useEffectEvent(callback)
  useEffect(() => {
    if (!desktop || !enabled) return
    return Events.On(name, (event) => onEvent(event))
  }, [desktop, enabled, name])
}
