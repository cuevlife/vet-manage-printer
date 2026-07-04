import type { USBDevice, DiagnosticReport, InstallResult, InstallProgress, ComponentType, ConnectionType } from '../../../main/printer-engine/types'

const api = window.electronAPI

export const printerApi = {
  // USB Detection
  listPorts: () => api.invoke('detect:list-ports') as Promise<USBDevice[]>,
  detectPortForType: (type: 'label' | 'bill') => api.invoke('detect:port-for-type', type) as Promise<USBDevice | null>,

  // Diagnostics
  runDiagnostics: () => api.invoke('diagnostics:run') as Promise<DiagnosticReport>,
  fixByReport: (report: DiagnosticReport) => api.invoke('diagnostics:fix', report) as Promise<InstallResult[]>,

  // Install
  installPrinter: (component: ComponentType, connectionType: ConnectionType, ipAddress?: string) =>
    api.invoke('install:printer', component, connectionType, ipAddress) as Promise<InstallResult>,
  installSmartCard: () => api.invoke('install:smartcard') as Promise<InstallResult>,
  installShortcut: (subdomain: string) => api.invoke('install:shortcut', subdomain) as Promise<InstallResult>,

  // Uninstall
  uninstallPrinter: (printerName: string) => api.invoke('uninstall:printer', printerName) as Promise<InstallResult>,
  uninstallComponent: (component: ComponentType) => api.invoke('uninstall:component', component) as Promise<InstallResult>,

  // Test Print
  testPrint: (printerName: string) => api.invoke('printer:test-print', printerName) as Promise<string>,

  // Java
  checkJava: () => api.invoke('java:check') as Promise<boolean>,
  installJava: () => api.invoke('java:install') as Promise<boolean>,

  // Events
  onInstallProgress: (callback: (progress: InstallProgress) => void) => api.on('install:progress', callback as (...args: unknown[]) => void)
}
