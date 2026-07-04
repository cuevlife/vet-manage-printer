import { execSync, exec, ChildProcess } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Run a command and return stdout
export async function runCmd(cmd: string, options?: { timeout?: number }): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, {
      timeout: options?.timeout ?? 30000,
      windowsHide: true
    })
    return stdout.trim()
  } catch (err: any) {
    throw new Error(`Command failed: ${cmd}\n${err.stderr || err.message}`)
  }
}

// Run a command and return raw buffer (for binary output)
export function runCmdSync(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', windowsHide: true }).trim()
  } catch (err: any) {
    return err.stdout?.trim() || ''
  }
}

// ─── PowerShell WMI helpers (wmic was removed in Windows 11) ───
// Uses -EncodedCommand to bypass all quoting issues with exec()→cmd→powershell
// whereExpr examples (PowerShell Where-Object syntax):
//   "$_.Name -eq 'VET Label'"
//   "$_.PNPClass -eq 'USB' -or $_.PNPClass -eq 'System'"
//   "$_.DeviceID -like 'USBPRINT*'"

function psCmd(script: string): string {
  const encoded = Buffer.from(script + '; exit 0', 'utf16le').toString('base64')
  return `powershell -NoProfile -EncodedCommand ${encoded}`
}

export async function wmiQuery(className: string, whereExpr?: string, properties?: string[]): Promise<string> {
  const where = whereExpr ? ` | Where-Object { ${whereExpr} }` : ''
  const select = properties && properties.length > 0 ? ` | Select-Object ${properties.join(',')}` : ''
  return runCmd(
    psCmd(`Get-CimInstance ${className}${where}${select} | ConvertTo-Csv -NoTypeInformation`),
    { timeout: 15000 }
  )
}

export async function wmiSet(className: string, whereExpr: string, properties: Record<string, string>): Promise<string> {
  const props = Object.entries(properties)
    .map(([k, v]) => `'${k}'='${v.replace(/'/g, "''")}'`)
    .join('; ')
  return runCmd(
    psCmd(`Get-CimInstance ${className} | Where-Object { ${whereExpr} } | Set-CimInstance -Property @{ ${props} }`),
    { timeout: 15000 }
  )
}

export async function wmiAction(className: string, whereExpr: string, action: string): Promise<string> {
  return runCmd(
    psCmd(`Get-CimInstance ${className} | Where-Object { ${whereExpr} } | ${action}`),
    { timeout: 15000 }
  )
}

// Parse PowerShell CSV output (ConvertTo-Csv format with headers)
// Returns array of rows (first row is header)
export function parseCSV(csv: string): string[][] {
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.startsWith('"'))
  return lines.map(l => l.split('","').map(s => s.replace(/^"|"$/g, '')))
}

// Registry read helper
export async function readRegistry(key: string, value: string): Promise<string | null> {
  try {
    const result = await runCmd(
      `reg query "${key}" /v "${value}" 2>nul | findstr /R /C:"${value}"`,
      { timeout: 5000 }
    )
    // Parse: `    ValueName    REG_SZ    ValueData`
    const parts = result.split(/\s+/)
    return parts.length >= 4 ? parts.slice(3).join(' ') : null
  } catch {
    return null
  }
}

// Registry enum subkeys helper
export async function enumRegistryKeys(key: string): Promise<string[]> {
  try {
    const result = await runCmd(
      `reg query "${key}" 2>nul | findstr /R "^HKEY"`,
      { timeout: 5000 }
    )
    return result ? result.split('\n').map(s => s.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

// Check if a file exists
export function fileExists(path: string): boolean {
  try {
    const result = runCmdSync(`if exist "${path}" (echo 1) else (echo 0)`)
    return result === '1'
  } catch {
    return false
  }
}

// Get environment variable
export function getEnvVar(name: string): string | null {
  return process.env[name] || null
}

// Run pnputil to add driver
export async function addDriverViaPnputil(infPath: string): Promise<string> {
  return runCmd(`pnputil /add-driver "${infPath}" /install`, { timeout: 60000 })
}

// Remove driver via pnputil
export async function removeDriverViaPnputil(oemId: string): Promise<string> {
  return runCmd(`pnputil /delete-driver "${oemId}" /uninstall`, { timeout: 30000 })
}

// Install printer via printui.dll
// /if = install from INF, /f = INF path, /b = printer name, /m = model name, /r = port name
export async function installPrinterViaPrintUI(infPath: string, printerName: string, modelName?: string, portName?: string): Promise<string> {
  let cmd = `rundll32 printui.dll,PrintUIEntry /if /f "${infPath}" /b "${printerName}" /q`
  if (modelName) cmd += ` /m "${modelName}"`
  if (portName) cmd += ` /r "${portName}"`
  return runCmd(cmd, { timeout: 60000 })
}

// Remove printer via printui.dll
export async function removePrinterViaPrintUI(printerName: string): Promise<string> {
  return runCmd(
    `rundll32 printui.dll,PrintUIEntry /dl /n "${printerName}" /q`,
    { timeout: 30000 }
  )
}

// Create LAN printer port
export async function createTCPIPPort(ipAddress: string, portName: string): Promise<string> {
  // First check if port exists
  const existing = await runCmd(
    `net stop spooler 2>nul & net start spooler 2>nul & cscript /nologo "%WINDIR%\\System32\\Printing_Admin_Scripts\\th-TH\\prnport.vbs" -l 2>nul | findstr /I /C:"${portName}"`,
    { timeout: 10000 }
  )
  if (existing.includes(portName)) {
    return `Port ${portName} already exists`
  }

  return runCmd(
    `cscript /nologo "%WINDIR%\\System32\\Printing_Admin_Scripts\\th-TH\\prnport.vbs" -a -r "${portName}" -h "${ipAddress}" -o raw -n 9100`,
    { timeout: 15000 }
  )
}

// Kill a process by name
export async function killProcess(name: string): Promise<void> {
  try {
    await runCmd(`taskkill /f /im ${name} 2>nul`, { timeout: 5000 })
  } catch {
    // Ignore if process not found
  }
}
