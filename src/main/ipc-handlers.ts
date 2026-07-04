import { ipcMain } from 'electron'

export function registerIpcHandlers() {
  // IPC handlers will be registered in later tasks
  // Placeholder keeps Rollup from tree-shaking the call
  ipcMain.handle('ping', () => 'pong')
}
