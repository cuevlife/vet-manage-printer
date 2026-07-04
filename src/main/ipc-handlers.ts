import { ipcMain, BrowserWindow } from 'electron'
import {
  listAllUSBDevices, detectUSBPort,
  installPrinter, uninstallPrinter, uninstallComponent, testPrint,
  runDiagnostics, fixByReport,
  checkJavaInstalled, installJava, createVetManageShortcut, removeVetManageShortcut,
  PRINTER_DEFINITIONS, InstallProgress, ConnectionType, ComponentType, InstallResult
} from './printer-engine'

export function registerIpcHandlers() {
  // ── USB Detection ──
  ipcMain.handle('detect:list-ports', async () => {
    return listAllUSBDevices()
  })

  ipcMain.handle('detect:port-for-type', async (_event, type: 'label' | 'bill') => {
    return detectUSBPort(type)
  })

  // ── Diagnostics ──
  ipcMain.handle('diagnostics:run', async () => {
    return runDiagnostics()
  })

  ipcMain.handle('diagnostics:fix', async (_event, report: any) => {
    return fixByReport(report)
  })

  // ── Install ──
  ipcMain.handle('install:printer', async (
    _event,
    component: ComponentType,
    connectionType: ConnectionType,
    ipAddress?: string
  ): Promise<InstallResult> => {
    const def = PRINTER_DEFINITIONS[component]
    if (!def) return { component, success: false, error: `Unknown component: ${component}` }
    return installPrinter({
      ...def,
      connectionType,
      ipAddress
    }, (progress: InstallProgress) => {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('install:progress', progress))
    })
  })

  ipcMain.handle('install:smartcard', async (): Promise<InstallResult> => {
    try {
      const javaOk = await checkJavaInstalled()
      if (!javaOk) {
        const installed = await installJava()
        if (!installed) return { component: 'smartcard', success: false, error: 'ติดตั้ง Java ไม่สำเร็จ' }
      }
      return { component: 'smartcard', success: true }
    } catch (err: any) {
      return { component: 'smartcard', success: false, error: err.message }
    }
  })

  ipcMain.handle('install:shortcut', async (_event, subdomain: string): Promise<InstallResult> => {
    try {
      await createVetManageShortcut(subdomain)
      return { component: 'vetmanage', success: true }
    } catch (err: any) {
      return { component: 'vetmanage', success: false, error: err.message }
    }
  })

  // ── Uninstall ──
  ipcMain.handle('uninstall:printer', async (_event, printerName: string) => {
    return uninstallPrinter(printerName)
  })

  ipcMain.handle('uninstall:component', async (
    _event,
    component: ComponentType
  ) => {
    if (component === 'vetmanage') {
      await removeVetManageShortcut()
      return { component, success: true } as InstallResult
    }
    return uninstallComponent(component)
  })

  // ── Test Print ──
  ipcMain.handle('printer:test-print', async (_event, printerName: string) => {
    return testPrint(printerName)
  })

  // ── Java ──
  ipcMain.handle('java:check', async () => {
    return checkJavaInstalled()
  })

  ipcMain.handle('java:install', async () => {
    return installJava()
  })

  // ── Ping (testing) ──
  ipcMain.handle('ping', () => 'pong')
}
