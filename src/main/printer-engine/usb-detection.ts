import { USBDevice, USB_KEYWORDS, VID_PID_MAP } from './types'
import { runCmd, readRegistry, enumRegistryKeys } from './utils'

function matchesKeywords(model: string, keywords: string[]): boolean {
  const upper = model.toUpperCase()
  return keywords.some(kw => upper.includes(kw.toUpperCase()))
}

function matchesVID(vid: string, validVIDs: string[]): boolean {
  return validVIDs.some(v => vid.toUpperCase() === v.toUpperCase())
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
    if (name) ports.push({ portName: name, hwid, description: desc, devicePath: devPath })
  }
  return ports
}

// Parse pnputil /enum-devices output
// Format:
//   Instance ID:                USB\VID_XXXX&PID_XXXX\...
//   Device Description:         Printer Name
//   Instance ID:                USBPRINT\MODEL\...&USB003
//   Device Description:         Model Name
function parsePnputilOutput(raw: string): { usbDevices: USBDevice[]; usbprintDevices: USBDevice[] } {
  const usbDevices: USBDevice[] = []
  const usbprintDevices: USBDevice[] = []
  const lines = raw.split('\n').map(l => l.trim())

  let currentInstanceId = ''
  let currentDesc = ''
  for (const line of lines) {
    if (line.startsWith('Instance ID:')) {
      currentInstanceId = line.replace('Instance ID:', '').trim()
      currentDesc = ''
    } else if (line.startsWith('Device Description:')) {
      currentDesc = line.replace('Device Description:', '').trim()
    } else if (line === '' && currentInstanceId) {
      // End of device block — process it
      if (currentInstanceId.startsWith('USB\\VID_')) {
        const vidMatch = currentInstanceId.match(/VID_([0-9A-F]{4})/i)
        const pidMatch = currentInstanceId.match(/PID_([0-9A-F]{4})/i)
        usbDevices.push({
          portName: '',
          vid: vidMatch ? vidMatch[1] : '',
          pid: pidMatch ? pidMatch[1] : '',
          model: currentDesc || currentInstanceId,
          isActive: true,
          instancePath: currentInstanceId
        })
      } else if (currentInstanceId.startsWith('USBPRINT\\')) {
        const modelMatch = currentInstanceId.match(/USBPRINT\\([^\\]+)/i)
        const portMatch = currentInstanceId.match(/USB(\d{3})/i)
        usbprintDevices.push({
          portName: portMatch ? `USB${portMatch[1]}` : '',
          vid: '', pid: '',
          model: modelMatch ? modelMatch[1] : (currentDesc || currentInstanceId),
          isActive: true,
          instancePath: currentInstanceId
        })
      }
      currentInstanceId = ''
      currentDesc = ''
    }
  }
  // Process last entry if no trailing blank line
  if (currentInstanceId && currentInstanceId.startsWith('USB\\VID_')) {
    const vidMatch = currentInstanceId.match(/VID_([0-9A-F]{4})/i)
    const pidMatch = currentInstanceId.match(/PID_([0-9A-F]{4})/i)
    usbDevices.push({
      portName: '',
      vid: vidMatch ? vidMatch[1] : '',
      pid: pidMatch ? pidMatch[1] : '',
      model: currentDesc || currentInstanceId,
      isActive: true,
      instancePath: currentInstanceId
    })
  } else if (currentInstanceId && currentInstanceId.startsWith('USBPRINT\\')) {
    const modelMatch = currentInstanceId.match(/USBPRINT\\([^\\]+)/i)
    const portMatch = currentInstanceId.match(/USB(\d{3})/i)
    usbprintDevices.push({
      portName: portMatch ? `USB${portMatch[1]}` : '',
      vid: '', pid: '',
      model: modelMatch ? modelMatch[1] : (currentDesc || currentInstanceId),
      isActive: true,
      instancePath: currentInstanceId
    })
  }

  return { usbDevices, usbprintDevices }
}

async function getPnputilData(): Promise<{ usbDevices: USBDevice[]; usbprintDevices: USBDevice[] }> {
  const raw = await runCmd('pnputil /enum-devices', { timeout: 10000 })
  return parsePnputilOutput(raw)
}

// Used by diagnostics.ts
export async function listAllUSBDevices(): Promise<USBDevice[]> {
  const data = await getPnputilData()
  const seen = new Set<string>()
  const all: USBDevice[] = []

  for (const d of data.usbDevices) {
    if (!seen.has(d.instancePath)) { seen.add(d.instancePath); all.push(d) }
  }
  for (const d of data.usbprintDevices) {
    if (!seen.has(d.instancePath)) { seen.add(d.instancePath); all.push(d) }
  }
  return all
}

// Used by Dashboard "หา Port"
export async function detectUSBPort(type: 'label' | 'bill'): Promise<USBDevice | null> {
  const keywords = USB_KEYWORDS[type]
  const validVIDs = VID_PID_MAP[type]
  const data = await getPnputilData()

  // Method 1: Registry match + verify
  const registryPorts = await getRegistryPorts()
  for (const rp of registryPorts) {
    if (matchesKeywords(rp.description, keywords)) {
      // Verify: check if USBPRINT device has this port
      const found = data.usbprintDevices.find(d => d.portName === rp.portName)
      if (found) return { ...rp, vid: '', pid: '', model: rp.description, isActive: true, instancePath: rp.devicePath }
    }
  }

  // Method 2: VID/PID match → find matching USBPRINT device for port name
  for (const d of data.usbDevices) {
    if (matchesVID(d.vid, validVIDs)) {
      // Try to find USBPRINT device that matches (by model name)
      const usbModel = d.model.replace(/[^a-zA-Z0-9]/g, '')
      const match = data.usbprintDevices.find(pd => {
        const printModel = pd.model.replace(/[^a-zA-Z0-9]/g, '')
        return usbModel.includes(printModel) || printModel.includes(usbModel)
      })
      if (match) return { ...match, vid: d.vid, pid: d.pid }
      return d  // USB device found but no port yet (driver not installed)
    }
  }

  // Method 3: USBPRINT model match
  for (const d of data.usbprintDevices) {
    if (d.model !== 'UNKNOWNPRINTER' && matchesKeywords(d.model, keywords)) {
      return d
    }
  }

  // Method 4: Single UNKNOWNPRINTER
  const unknown = data.usbprintDevices.filter(d => d.model === 'UNKNOWNPRINTER')
  if (unknown.length === 1) return unknown[0]

  // Method 5-7: Single/Last USB port
  if (data.usbprintDevices.length === 1) return data.usbprintDevices[0]
  if (data.usbprintDevices.length > 1) {
    return data.usbprintDevices.sort((a, b) => {
      const numA = parseInt(a.portName.replace('USB', '')) || 0
      const numB = parseInt(b.portName.replace('USB', '')) || 0
      return numB - numA
    })[0]
  }

  return null
}
