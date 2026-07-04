export type ComponentType = 'label' | 'bill' | 'smartcard' | 'vetmanage'
export type ConnectionType = 'USB' | 'LAN'
export type PrinterAction = 'install' | 'fix' | 'uninstall'

export interface USBDevice {
  portName: string
  vid: string
  pid: string
  model: string
  isActive: boolean
  instancePath: string
}

export interface PrinterConfig {
  printerName: string
  printerType: ComponentType
  connectionType: ConnectionType
  ipAddress?: string
  infPath: string
  driverName: string
  configDatPath: string
}

export interface PrinterInfo {
  name: string
  installed: boolean
  driverName: string
  portName: string
  isOnline: boolean
  status: string
  printQueueCount: number
}

export interface DriverInfo {
  name: string
  manufacturer: string
  infName: string
  isSigned: boolean
  version: string
  provider: string
}

export interface PrinterDiagnostic {
  installed: boolean
  connected: boolean
  driverOk: boolean
  portConfigured: boolean
  printerOnline: boolean
  details: string[]
}

export interface SmartCardDiagnostic {
  javaInstalled: boolean
  serviceRunning: boolean
  readerConnected: boolean
  details: string[]
}

export interface DiagnosticReport {
  overall: 'healthy' | 'has_issues' | 'critical'
  usb: {
    status: 'ok' | 'warning' | 'error'
    devices: USBDevice[]
    message: string
  }
  label: PrinterDiagnostic
  bill: PrinterDiagnostic
  smartcard: SmartCardDiagnostic
  recommendations: string[]
}

export interface InstallProgress {
  component: ComponentType
  phase: string
  percent: number
  message: string
}

export interface InstallResult {
  component: ComponentType
  success: boolean
  error?: string
}

export const PRINTER_DEFINITIONS: Record<string, Omit<PrinterConfig, 'connectionType' | 'ipAddress'>> = {
  label: {
    printerName: 'VET Label',
    printerType: 'label',
    infPath: 'resources\\drivers\\label\\Xprinter.inf',
    driverName: 'Xprinter XP-420B',
    configDatPath: 'resources\\drivers\\label\\VetLabelConfig.dat'
  },
  bill: {
    printerName: 'VET Bill',
    printerType: 'bill',
    infPath: 'resources\\drivers\\bill\\Windows x64\\XPDRVx64.INF',
    driverName: 'XP-80',
    configDatPath: 'resources\\drivers\\bill\\VetBillConfig.dat'
  }
}

export const USB_KEYWORDS = {
  bill: ['80', 'XP', 'POS', 'Receipt', 'Thermal', '58', '76', 'Bill'],
  label: ['4BARCODE', '420', '430', 'Xprinter', 'TSC', 'Label', '2074G', 'XP-4']
}

export const VID_PID_MAP = {
  bill: ['1FC9', '04B8', '0FE6'],
  label: ['0483', '2D84', '04B8']
}
