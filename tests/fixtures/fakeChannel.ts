// BroadcastChannel falso en memoria: simula varias pestañas del mismo navegador (RF40).
// Igual que el real, un mensaje llega a TODOS los demás canales con ese nombre, pero no al que lo envía.
// Entrega síncrona y con copia estructurada (como el real, el dato recibido no comparte referencias).

export interface FakeChannel {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(data: unknown): void
  close(): void
}

export interface FakeChannelHub {
  /** Crea un canal; cada llamada equivale a `new BroadcastChannel(name)` en una pestaña. */
  factory: (name: string) => FakeChannel
}

export function createFakeChannelHub(): FakeChannelHub {
  const channels = new Map<string, Set<FakeChannel>>()

  return {
    factory(name) {
      const peers = channels.get(name) ?? new Set<FakeChannel>()
      channels.set(name, peers)

      const channel: FakeChannel = {
        onmessage: null,
        postMessage(data) {
          for (const peer of peers) {
            if (peer !== channel) peer.onmessage?.({ data: structuredClone(data) })
          }
        },
        close() {
          peers.delete(channel)
        },
      }
      peers.add(channel)
      return channel
    },
  }
}
