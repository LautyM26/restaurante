// Preparación global de los tests: matchers de jest-dom y los stubs que jsdom no trae.
import '@testing-library/jest-dom/vitest'

// matchMedia: sin coincidencias por defecto (sin movimiento reducido, sin hover).
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Observadores: jsdom no los implementa; los tests que los necesiten los simulan por su cuenta.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
if (!('IntersectionObserver' in window)) {
  Object.defineProperty(window, 'IntersectionObserver', { value: NoopObserver, configurable: true, writable: true })
}
if (!('ResizeObserver' in window)) {
  Object.defineProperty(window, 'ResizeObserver', { value: NoopObserver, configurable: true, writable: true })
}

// Desplazamiento: jsdom no lo implementa.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
window.scrollTo = (() => {}) as typeof window.scrollTo

// <dialog>: showModal/close pueden faltar en jsdom (las hojas de T7 dependen de ellos).
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
