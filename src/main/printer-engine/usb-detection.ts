import { USBDevice, USB_KEYWORDS, VID_PID_MAP } from './types'
import { wmiQuery, readRegistry, enumRegistryKeys, runCmd } from './utils'

// ─── Helpers ───

function matchesKeywords(model: string, keywords: string[]): boolean {
  const upper = model.toUpperCase()
  return keywords.some(kw => upper.includes(kw.toUpperCase()))
}

function matchesVID(vid: string, validVIDs: string[]): boolean {
  return validVIDs.some(v => vid.toUpperCase().includes(v.toUpperCase()))
}

interface RegistryPortInfo {
  portName: string
  hwid: string
  description: string
  devicePath: string
}

async function getRegistryPorts(): Promise<RegistryPortInfo[]> {
  const ports: RegistryPortInfo[] = []
  const key = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Monitors\\USB Monitor\\Ports'
  const subKeys = await enumRegistryKeys(key)
  
  for (const subKey of subKeys) {
    const name = subKey.split('\\').pop() || ''
    const hwid = await readRegistry(subKey, 'HWID') || ''
    const desc = await readRegistry(subKey, 'Description') || ''
    const devPath = await readRegistry(subKey, 'DevicePath') || ''
    if (name) {
      ports.push({ portName: name, hwid, description: desc, devicePath: devPath })
    }
  }
  return ports
}

async function getActiveUSBPRINTDevices(): Promise<USBDevice[]> {
  const devices: USBDevice[] = []
  const raw = await runCmd(
    `wmic path Win32_PnPEntity GET DeviceID,PNPDeviceID,Status,Caption,PNPClass /FORMAT:CSV 2>nul`
  )
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))

  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length < 6) continue
    const deviceId = parts[1]?.trim() || ''
    const pnpId = parts[2]?.trim() || ''
    const status = parts[3]?.trim() || ''
    const caption = parts[4]?.trim() || ''
    const pnpClass = parts[5]?.trim() || ''

    if (status !== 'OK') continue
    if (pnpClass !== 'USB' && pnpClass !== 'System') continue

    const vidMatch = pnpId.match(/VID_([0-9A-F]{4})/i)
    const pidMatch = pnpId.match(/PID_([0-9A-F]{4})/i)
    const vid = vidMatch ? vidMatch[1] : ''
    const pid = pidMatch ? pidMatch[1] : ''

    devices.push({
      portName: '',
      vid,
      pid,
      model: caption || pnpId,
      isActive: true,
      instancePath: pnpId
    })
  }
  return devices.filter(d => d.isActive)
}

async function getUSBPRINTDeviceModels(): Promise<USBDevice[]> {
  const devices: USBDevice[] = []
  const raw = await runCmd(
    `wmic path Win32_PnPEntity WHERE "DeviceID LIKE 'USBPRINT%%'" GET DeviceID,Status,Caption /FORMAT:CSV 2>nul`
  )
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))
  
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length < 4) continue
    const deviceId = parts[1]?.trim() || ''
    const status = parts[2]?.trim() || ''
    const caption = parts[3]?.trim() || ''
    if (status !== 'OK') continue

    // Parse USBPRINT\MODEL\INSTANCE\USBXXX
    const modelMatch = deviceId.match(/USBPRINT\\([^\\]+)/i)
    const portMatch = deviceId.match(/USB(\d{3})/i)
    const model = modelMatch ? modelMatch[1] : caption
    const portName = portMatch ? `USB${portMatch[1]}` : ''

    devices.push({
      portName,
      vid: '',
      pid: '',
      model,
      isActive: true,
      instancePath: deviceId
    })
  }
  return devices
}

async function getPortDescriptionFromPrintUI(portName: string): Promise<string> {
  try {
    const raw = await runCmd(
      `wmic path Win32_TCPIPPrinterPort WHERE Name='${portName}' GET Description /VALUE 2>nul`
    )
    const match = raw.match(/Description=(.+)/)
    return match ? match[1].trim() : ''
  } catch {
    return ''
  }
}

// ─── Main detection ───

export async function listAllUSBDevices(): Promise<USBDevice[]> {
  const all: USBDevice[] = []
  const seen = new Set<string>()

  // Method 1-2: Active USB devices with VID/PID
  const activeDevices = await getActiveUSBPRINTDevices()
  for (const d of activeDevices) {
    if (!seen.has(d.instancePath)) {
      seen.add(d.instancePath)
      all.push(d)
    }
  }

  // Method 3: USBPRINT model names
  const usbprintDevices = await getUSBPRINTDeviceModels()
  for (const d of usbprintDevices) {
    if (!seen.has(d.instancePath)) {
      seen.add(d.instancePath)
      all.push(d)
    }
  }

  return all
}

export async function detectUSBPort(type: 'label' | 'bill'): Promise<USBDevice | null> {
  const keywords = USB_KEYWORDS[type]
  const validVIDs = VID_PID_MAP[type]

  // Method 1: Registry match + verify active
  const registryPorts = await getRegistryPorts()
  for (const rp of registryPorts) {
    if (matchesKeywords(rp.description + ' ' + rp.hwid, keywords)) {
      // Verify: check USBPRINT device has this port
      const raw = await runCmd(
        `wmic path Win32_PnPEntity WHERE "DeviceID LIKE 'USBPRINT%%${rp.portName}'" GET Status /FORMAT:CSV 2>nul`
      )
      if (raw.includes('OK')) {
        return {
          portName: rp.portName,
          vid: '',
          pid: '',
          model: rp.description,
          isActive: true,
          instancePath: rp.devicePath
        }
      }
    }
  }

  // Method 2: VID/PID match from active USB devices
  const activeDevices = await getActiveUSBPRINTDevices()
  for (const d of activeDevices) {
    if (matchesVID(d.vid, validVIDs)) {
      // Find the USBPRINT port for this device
      const printDevices = await getUSBPRINTDeviceModels()
      for (const pd of printDevices) {
        if (pd.portName) {
          return { ...pd, vid: d.vid, pid: d.pid }
        }
      }
      // If no port yet but VID matches, return the device
      return d
    }
  }

  // Method 3: USBPRINT model match
  const usbprintDevices = await getUSBPRINTDeviceModels()
  for (const d of usbprintDevices) {
    if (d.model !== 'UNKNOWNPRINTER' && matchesKeywords(d.model, keywords)) {
      return d
    }
  }

  // Method 4: Single UNKNOWNPRINTER
  const unknown = usbprintDevices.filter(d => d.model === 'UNKNOWNPRINTER')
  if (unknown.length === 1) {
    return unknown[0]
  }

  // Method 5: Get-PrinterPort description
  const printerPortsRaw = await runCmd(
    `wmic path Win32_PrinterPort WHERE Name LIKE 'USB%' GET Name,Description /FORMAT:CSV 2>nul`
  )
  const portLines = printerPortsRaw.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))
  for (const line of portLines) {
    const parts = line.split(',')
    if (parts.length < 3) continue
    const pName = parts[1]?.trim() || ''
    const pDesc = parts[2]?.trim() || ''
    if (matchesKeywords(pDesc, keywords)) {
      // Verify active
      const raw = await runCmd(
        `wmic path Win32_PnPEntity WHERE "DeviceID LIKE 'USBPRINT%%${pName}'" GET Status /FORMAT:CSV 2>nul`
      )
      if (raw.includes('OK')) {
        return { portName: pName, vid: '', pid: '', model: pDesc, isActive: true, instancePath: '' }
      }
    }
  }

  // Method 6-7: Single / Last USB port
  if (usbprintDevices.length === 1) {
    return usbprintDevices[0]
  }
  if (usbprintDevices.length > 1) {
    // Return highest-numbered USB port (most recently connected)
    const sorted = usbprintDevices.sort((a, b) => {
      const numA = parseInt(a.portName.replace('USB', '')) || 0
      const numB = parseInt(b.portName.replace('USB', '')) || 0
      return numB - numA
    })
    return sorted[0]
  }

  // Method 8: Hard fail
  return null
}
