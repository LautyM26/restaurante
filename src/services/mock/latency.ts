// Latencia simulada de las llamadas del mock (plan §7.2). Con 0 no usa temporizadores: los tests no esperan.

export function wait(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}
