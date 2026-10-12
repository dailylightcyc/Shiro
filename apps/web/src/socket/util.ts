import type { BusinessEvents, EventPayloadMapping } from '@mx-space/webhook'

// Keep the webhook's Node-only signature verifier out of browser bundles while
// deriving event names and payloads from the CMS protocol types.
type ClientEventPayloads = {
  [T in keyof EventPayloadMapping as `${T}`]: EventPayloadMapping[T]
}

export const buildSocketEventType = (type: string) =>
  `ws_event:${type}` as const

export class WsEvent extends Event {
  constructor(
    type: BusinessEvents,
    public data: unknown,
  ) {
    super(buildSocketEventType(type))
  }

  static on<T extends keyof ClientEventPayloads>(
    type: T,
    cb: (data: ClientEventPayloads[T]) => void,
  ) {
    const _cb = (e: any) => {
      cb(e.data)
    }
    document.addEventListener(buildSocketEventType(type), _cb)

    return () => {
      document.removeEventListener(buildSocketEventType(type), _cb)
    }
  }

  static emit(type: BusinessEvents, data: unknown) {
    document.dispatchEvent(new WsEvent(type, data))
  }
}
