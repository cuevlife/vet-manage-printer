import { USBDevice, USB_KEYWORDS, VID_PID_MAP } from './types'
import { wmiQuery, runCmd, readRegistry, enumRegistryKeys, parseCSV } from './utils'

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

async function getActiveUSBDevices(): Promise<USBDevice[]> {
  const devices: USBDevice[] = []
  try {
    const raw = await wmiQuery('Win32_PnPEntity', "$_.PNPClass -eq 'USB' -or $_.PNPClass -eq 'System'", ['DeviceID', 'PNPDeviceID', 'Status', 'Caption', 'PNPClass'])
    const rows = parseCSV(raw)
    const header = rows[0]
    if (!header) return []
    for (const row of rows.slice(1)) {
      const status = row[header.indexOf('Status')] || ''
      const pnpId = row[header.indexOf('PNPDeviceID')] || ''
      const caption = row[header.indexOf('Caption')] || ''
      if (status !== 'OK') continue

      const vidMatch = pnpId.match(/VID_([0-9A-F]{4})/i)
      const pidMatch = pnpId.match(/PID_([0-9A-F]{4})/i)
      devices.push({
        portName: '',
        vid: vidMatch ? vidMatch[1] : '',
        pid: pidMatch ? pidMatch[1] : '',
        model: caption || pnpId,
        isActive: true,
        instancePath: pnpId
      })
    }
  } catch {
    // Fallback: pnputil
    const fallback = await runCmd('pnputil /enum-devices', { timeout: 10000 })
    const lines = fallback.split('\n').map(l => l.trim())
    for (const line of lines) {
      if (line.includes('USB\\VID_')) {
        const vidMatch = line.match(/VID_([0-9A-F]{4})/i)
        const pidMatch = line.match(/PID_([0-9A-F]{4})/i)
        const nameMatch = line.match(/: (.+)/)
        devices.push({
          portName: '',
          vid: vidMatch ? vidMatch[1] : '',
          pid: pidMatch ? pidMatch[1] : '',
          model: nameMatch ? nameMatch[1] : line,
          isActive: true,
          instancePath: line
        })
      }
    }
  }
  return devices
}

async function getUSBPRINTDevices(): Promise<USBDevice[]> {
  const devices: USBDevice[] = []
  try {
    const raw = await wmiQuery('Win32_PnPEntity', "$_.DeviceID -like 'USBPRINT*'", ['DeviceID', 'Status', 'Caption'])
    const rows = parseCSV(raw)
    const header = rows[0]
    if (!header) return []
    for (const row of rows.slice(1)) {
      const deviceId = row[header.indexOf('DeviceID')] || ''
      const status = row[header.indexOf('Status')] || ''
      const caption = row[header.indexOf('Caption')] || ''
      if (status !== 'OK') continue
      const modelMatch = deviceId.match(/USBPRINT\\([^\\]+)/i)
      const portMatch = deviceId.match(/USB(\d{3})/i)
      devices.push({
        portName: portMatch ? `USB${portMatch[1]}` : '',
        vid: '', pid: '',
        model: modelMatch ? modelMatch[1] : caption,
        isActive: true,
        instancePath: deviceId
      })
    }
  } catch {
    // Fallback: registry
    const raw = await runCmd(
      `reg query "HKLM\\SYSTEM\\CurrentControlSet\\Enum\\USBPRINT" /s 2>nul | findstr /R "USB\\\\d{3}"`
    )
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      const portMatch = line.match(/USB(\d{3})/)
      if (portMatch) {
        devices.push({
          portName: `USB${portMatch[1]}`,
          vid: '', pid: '',
          model: 'USB Printer',
          isActive: true,
          instancePath: line
        })
      }
    }
  }
  return devices
}

async function verifyPortActive(portName: string): Promise<boolean> {
  try {
    const raw = await wmiQuery('Win32_PnPEntity', `$_.DeviceID -like '*USBPRINT*${portName}*'`, ['Status'])
    return raw.includes('OK')
  } catch {
    return false
  }
}

export async function listAllUSBDevices(): Promise<USBDevice[]> {
  const all: USBDevice[] = []
  const seen = new Set<string>()

  const active = await getActiveUSBDevices()
  for (const d of active) {
    if (!seen.has(d.instancePath)) { seen.add(d.instancePath); all.push(d) }
  }

  const usbprint = await getUSBPRINTDevices()
  for (const d of usbprint) {
    if (!seen.has(d.instancePath)) { seen.add(d.instancePath); all.push(d) }
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
      if (await verifyPortActive(rp.portName)) {
        return { portName: rp.portName, vid: '', pid: '', model: rp.description, isActive: true, instancePath: rp.devicePath }
      }
    }
  }

  // Method 2: VID/PID match
  const activeDevices = await getActiveUSBDevices()
  for (const d of activeDevices) {
    if (matchesVID(d.vid, validVIDs)) {
      const printDevices = await getUSBPRINTDevices()
      for (const pd of printDevices) {
        if (pd.portName) return { ...pd, vid: d.vid, pid: d.pid }
      }
      return d
    }
  }

  // Method 3: USBPRINT model match
  const usbprintDevices = await getUSBPRINTDevices()
  for (const d of usbprintDevices) {
    if (d.model !== 'UNKNOWNPRINTER' && matchesKeywords(d.model, keywords)) {
      return d
    }
  }

  // Method 4: Single UNKNOWNPRINTER
  const unknown = usbprintDevices.filter(d => d.model === 'UNKNOWNPRINTER')
  if (unknown.length === 1) return unknown[0]

  // Method 5: Printer port description
  try {
    const raw = await wmiQuery('Win32_PrinterPort', undefined, ['Name', 'Description'])
    const rows = parseCSV(raw)
    const header = rows[0]
    if (header) {
      for (const row of rows.slice(1)) {
        const name = row[header.indexOf('Name')] || ''
        if (!name.startsWith('USB')) continue
        const desc = row[header.indexOf('Description')] || ''
        if (matchesKeywords(desc, keywords) && await verifyPortActive(name)) {
          return { portName: name, vid: '', pid: '', model: desc, isActive: true, instancePath: '' }
        }
      }
    }
  } catch {}

  // Method 6-7: Single/Last USB port
  if (usbprintDevices.length === 1) return usbprintDevices[0]
  if (usbprintDevices.length > 1) {
    return usbprintDevices.sort((a, b) => {
      const numA = parseInt(a.portName.replace('USB', '')) || 0
      const numB = parseInt(b.portName.replace('USB', '')) || 0
      return numB - numA
    })[0]
  }

  // Method 8: Hard fail
  return null
}
