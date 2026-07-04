import { DiagnosticReport, PrinterDiagnostic, SmartCardDiagnostic, USBDevice, PRINTER_DEFINITIONS } from './types'
import { listAllUSBDevices, detectUSBPort } from './usb-detection'
import { installPrinter } from './driver-install'
import { runCmd, readRegistry, wmiQuery, parseCSV } from './utils'
import { InstallResult } from './types'

async function checkPrinter(printerName: string): Promise<PrinterDiagnostic> {
  const details: string[] = []

  let raw: string
  try {
    raw = await wmiQuery('Win32_Printer', `$_.Name -eq '${printerName}'`, ['Name', 'DriverName', 'PortName', 'PrinterStatus', 'WorkOffline'])
  } catch {
    details.push(`❌ ไม่สามารถตรวจสอบ ${printerName} ได้`)
    return { installed: false, connected: false, driverOk: false, portConfigured: false, printerOnline: false, details }
  }

  const rows = parseCSV(raw)
  if (rows.length < 2) {
    details.push(`❌ ไม่พบ ${printerName} ในระบบ`)
    return { installed: false, connected: false, driverOk: false, portConfigured: false, printerOnline: false, details }
  }

  details.push(`✅ ${printerName} มีในระบบ`)
  const header = rows[0]
  const data = rows[1]

  const portName = data[header.indexOf('PortName')] || ''
  const driverName = data[header.indexOf('DriverName')] || ''
  const printerStatus = parseInt(data[header.indexOf('PrinterStatus')] || '0')
  const workOffline = parseInt(data[header.indexOf('WorkOffline')] || '0')

  const hasPort = portName.length > 0
  if (hasPort) {
    details.push(`✅ พอร์ต: ${portName}`)
  } else {
    details.push(`⚠️ ไม่พบพอร์ต`)
  }

  const driverOk = driverName.length > 0
  if (driverOk) {
    details.push(`✅ Driver: ${driverName}`)
  } else {
    details.push(`❌ ไม่พบ Driver`)
  }

  const isOnline = workOffline === 0
  const statusMap: Record<number, string> = {
    0: 'พร้อมใช้งาน',
    1: 'หยุดชั่วคราว', 2: 'กำลังพิมพ์',
    3: 'ว่าง', 4: 'กำลังพิมพ์',
    5: 'รอ'
  }
  const statusStr = statusMap[printerStatus] || `สถานะ ${printerStatus}`
  // printerStatus 0=ready, 3=idle → OK; 1=paused, 2=printing → info; other → warning
  const statusOk = printerStatus === 0 || printerStatus === 3 || printerStatus === 4
  details.push(`${statusOk ? '✅' : '⚠️'} สถานะ: ${statusStr}`)
  if (workOffline === 1) details.push(`ℹ️ ถูกตั้งค่า Offline — คลิกขวาที่ Printer > ใช้เครื่องพิมพ์ออนไลน์`)

  return {
    installed: true,
    connected: hasPort,
    driverOk,
    portConfigured: hasPort,
    printerOnline: true, // WorkOffline มักเป็น 1 ใน printer รุ่นนี้แม้ทำงานได้
    details
  }
}

async function checkJava(): Promise<SmartCardDiagnostic> {
  const details: string[] = []

  let javaFound = false
  try {
    const javaVersion = await runCmd('java -version 2>&1', { timeout: 5000 })
    javaFound = javaVersion.toLowerCase().includes('version')
    if (javaFound) details.push('✅ พบ Java ใน PATH')
  } catch {
    javaFound = false
  }

  if (!javaFound) {
    let javaHome = await readRegistry(
      'HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment',
      'CurrentVersion'
    )
    if (javaHome) {
      const home = await readRegistry(
        `HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment\\${javaHome}`,
        'JavaHome'
      )
      if (home) {
        try {
          const v = await runCmd(`"${home}\\bin\\java" -version 2>&1`, { timeout: 5000 })
          javaFound = v.toLowerCase().includes('version')
        } catch {}
      }
    }

    if (!javaFound) {
      const adoptiumHome = await readRegistry(
        'HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE\\17',
        'JavaHome'
      )
      if (adoptiumHome) {
        try {
          const v = await runCmd(`"${adoptiumHome}\\bin\\java" -version 2>&1`, { timeout: 5000 })
          javaFound = v.toLowerCase().includes('version')
        } catch {}
      }
    }

    if (javaFound) {
      details.push('✅ พบ Java ผ่าน Registry')
    } else {
      details.push('❌ ไม่พบ Java กรุณาติดตั้ง Java ก่อนใช้งาน SmartCard')
    }
  }

  return {
    javaInstalled: javaFound,
    serviceRunning: false,
    readerConnected: false,
    details
  }
}

export async function runDiagnostics(): Promise<DiagnosticReport> {
  const recommendations: string[] = []

  const usbDevices = await listAllUSBDevices()
  const usbStatus = usbDevices.length > 0 ? 'ok' : 'warning'
  const usbMessage = usbDevices.length > 0
    ? `พบอุปกรณ์ USB ${usbDevices.length} ตัว`
    : '⚠️ ไม่พบอุปกรณ์ USB ที่เชื่อมต่ออยู่'

  if (usbDevices.length === 0) {
    recommendations.push('เสียบสาย USB เครื่องพิมพ์และเปิดเครื่อง แล้วกดตรวจสอบอีกครั้ง')
  }

  const label = await checkPrinter('VET Label')
  const bill = await checkPrinter('VET Bill')
  const smartcard = await checkJava()

  if (!label.installed) recommendations.push('ติดตั้ง VET Label (เครื่องพิมพ์ฉลาก)')
  if (!bill.installed) recommendations.push('ติดตั้ง VET Bill (เครื่องพิมพ์ใบเสร็จ)')
  if (!smartcard.javaInstalled) recommendations.push('ติดตั้ง Java Runtime Environment สำหรับ SmartCard')

  const critical = [label, bill].filter(d => !d.installed).length

  const hasIssues = recommendations.length > 0
  const overall = critical > 0 ? 'critical' : hasIssues ? 'has_issues' : 'healthy'

  return {
    overall,
    usb: { status: usbStatus, devices: usbDevices, message: usbMessage },
    label,
    bill,
    smartcard,
    recommendations
  }
}

export async function fixByReport(report: DiagnosticReport): Promise<InstallResult[]> {
  const results: InstallResult[] = []

  if (!report.label.installed || !report.label.printerOnline) {
    results.push(await installPrinter({
      ...PRINTER_DEFINITIONS.label,
      connectionType: 'USB'
    }))
  }

  if (!report.bill.installed || !report.bill.printerOnline) {
    results.push(await installPrinter({
      ...PRINTER_DEFINITIONS.bill,
      connectionType: 'USB'
    }))
  }

  return results
}
