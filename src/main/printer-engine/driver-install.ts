import { PrinterConfig, InstallProgress, InstallResult, ComponentType, PRINTER_DEFINITIONS } from './types'
import { detectUSBPort, listAllUSBDevices } from './usb-detection'
import {
  addDriverViaPnputil, installPrinterViaPrintUI, removePrinterViaPrintUI,
  createTCPIPPort, runCmd, fileExists, killProcess, removeDriverViaPnputil
} from './utils'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { execSync } from 'child_process'

type ProgressCallback = (progress: InstallProgress) => void

function getResourcePath(relativePath: string): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
  return join(base, relativePath)
}

export async function installPrinter(
  config: PrinterConfig,
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  const component = config.printerType

  const progress = (phase: string, percent: number, message: string) => {
    onProgress?.({ component, phase, percent, message })
  }

  try {
    progress('preparing', 10, 'กำลังเตรียมติดตั้ง...')

    const infPath = getResourcePath(config.infPath.replace('resources\\', ''))
    const configDatPath = config.configDatPath ? getResourcePath(config.configDatPath.replace('resources\\', '')) : ''

    if (!existsSync(infPath)) {
      throw new Error(`ไม่พบไฟล์ driver: ${infPath}`)
    }

    let portName = config.ipAddress ? `IP_${config.ipAddress}` : ''
    if (config.connectionType === 'USB') {
      progress('usb-detect', 20, 'กำลังตรวจสอบพอร์ต USB...')

      const usbDevice = await detectUSBPort(component as 'label' | 'bill')
      if (usbDevice && usbDevice.portName) {
        portName = usbDevice.portName
      } else {
        const all = await listAllUSBDevices()
        const printPorts = all.filter(d => d.portName)
        if (printPorts.length > 0) {
          portName = printPorts[0].portName
        }
      }

      if (!portName) {
        throw new Error('ไม่พบเครื่องพิมพ์ที่เชื่อมต่อ USB กรุณาเสียบสาย USB และตรวจสอบว่าเปิดเครื่องพิมพ์อยู่')
      }
    }

    if (config.connectionType === 'LAN' && config.ipAddress) {
      progress('lan-port', 30, `กำลังสร้างพอร์ต LAN: ${portName}...`)
      await createTCPIPPort(config.ipAddress, portName!)
    }

    progress('add-driver', 40, 'กำลังเพิ่ม driver ลงในระบบ...')
    try {
      await addDriverViaPnputil(infPath)
    } catch (err: any) {
      if (!err.message.includes('0x800b0109')) {
        progress('add-driver', 45, 'driver อาจมีอยู่แล้ว ดำเนินการต่อ...')
      }
    }

    progress('install-printer', 60, `กำลังติดตั้ง ${config.printerName}...`)
    await installPrinterViaPrintUI(infPath, config.printerName)

    if (portName) {
      progress('config-port', 75, `กำลังตั้งค่าพอร์ต ${portName}...`)
      await runCmd(
        `wmic path Win32_Printer WHERE Name="${config.printerName}" SET PortName="${portName}" 2>nul`
      )
    }

    if (configDatPath && existsSync(configDatPath)) {
      progress('restore-config', 85, 'กำลังกู้คืนการตั้งค่า...')
      await runCmd(
        `wmic path Win32_Printer WHERE Name="${config.printerName}" SET ConfigFile="${configDatPath}" 2>nul`
      )
    }

    progress('finalize', 95, 'กำลังตั้งค่าเริ่มต้น...')
    await runCmd(
      `wmic path Win32_Printer WHERE Name="${config.printerName}" SET Default=True 2>nul`
    )

    progress('done', 100, `ติดตั้ง ${config.printerName} เสร็จสมบูรณ์`)

    return { component, success: true }
  } catch (err: any) {
    return { component, success: false, error: err.message }
  }
}

export async function uninstallPrinter(printerName: string): Promise<InstallResult> {
  const component: ComponentType = printerName.includes('Label') ? 'label' : 'bill'

  try {
    await removePrinterViaPrintUI(printerName)

    await runCmd(
      `wmic path Win32_Printer WHERE Name="${printerName}" DELETE 2>nul`
    )

    return { component, success: true }
  } catch (err: any) {
    return { component, success: false, error: err.message }
  }
}

export async function cleanupAllPrinters(): Promise<void> {
  const raw = await runCmd(
    `wmic path Win32_Printer GET Name /FORMAT:CSV 2>nul`
  )
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))
  const keywords = ['VET', 'Label', 'Bill', 'Xprinter', 'XP-']
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length >= 2) {
      const name = parts[1].trim()
      if (name && keywords.some(kw => name.toUpperCase().includes(kw.toUpperCase()))) {
        await removePrinterViaPrintUI(name).catch(() => {})
      }
    }
  }
}

export async function uninstallComponent(
  component: ComponentType,
  onProgress?: ProgressCallback
): Promise<InstallResult> {
  const progress = (phase: string, percent: number, message: string) => {
    onProgress?.({ component, phase, percent, message })
  }

  try {
    switch (component) {
      case 'label':
        progress('uninstalling', 20, 'กำลังถอน VET Label...')
        await uninstallPrinter('VET Label')
        break
      case 'bill':
        progress('uninstalling', 20, 'กำลังถอน VET Bill...')
        await uninstallPrinter('VET Bill')
        break
      case 'smartcard': {
        progress('killing', 10, 'กำลังปิดกระบวนการ SmartCard...')
        await killProcess('java.exe')
        await killProcess('javaw.exe')
        progress('removing', 50, 'กำลังลบไฟล์ SmartCard...')
        const smartCardPath = join(app.getPath('exe'), '..', 'Drivers', 'SmartCard')
        execSync(`rmdir /s /q "${smartCardPath}"`, { windowsHide: true })
        break
      }
      case 'vetmanage':
        progress('removing', 50, 'กำลังลบ Shortcut VET MANAGE...')
        const desktop = app.getPath('desktop')
        const startMenu = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        const urls = [
          join(desktop, 'VET MANAGE.url'),
          join(startMenu, 'VET MANAGE Printer Driver', 'VET MANAGE Login.url')
        ]
        for (const url of urls) {
          try { unlinkSync(url) } catch {}
        }
        break
    }

    progress('done', 100, 'ดำเนินการเสร็จสมบูรณ์')
    return { component, success: true }
  } catch (err: any) {
    return { component, success: false, error: err.message }
  }
}

export async function testPrint(printerName: string): Promise<string> {
  return runCmd(
    `rundll32 printui.dll,PrintUIEntry /k /n "${printerName}"`,
    { timeout: 30000 }
  )
}
