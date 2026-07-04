/// <reference types="vite/client" />

interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
  send: (channel: string, ...args: unknown[]) => void
  windowControls: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
}

interface Window {
  electronAPI: ElectronAPI
}
