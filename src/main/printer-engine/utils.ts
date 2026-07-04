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

// WMI query via PowerShell (wmic was removed in Windows 11)
export async function wmiQuery(query: string): Promise<string> {
  return runCmd(
    `powershell -Command "Get-CimInstance ${query} | ConvertTo-Csv -NoTypeInformation"`,
    { timeout: 15000 }
  )
}

// WMI query with filter — returns CSV parsed into array of objects
// Usage: wmiFilter('Win32_Printer', 'Name LIKE "%VET%"')
// Escapes single quotes for PowerShell
export async function wmiFilter(className: string, filter?: string): Promise<string> {
  const f = filter ? ` -Filter "${filter.replace(/"/g, '\\"')}"` : ''
  return runCmd(
    `powershell -Command "Get-CimInstance ${className}${f} | ConvertTo-Csv -NoTypeInformation"`,
    { timeout: 15000 }
  )
}

// WMI action (SET/DELETE) via PowerShell
export async function wmiAction(className: string, filter: string, action: string): Promise<string> {
  return runCmd(
    `powershell -Command "Get-CimInstance ${className} -Filter \\"${filter.replace(/"/g, '\\"')}\\" | ${action}"`,
    { timeout: 15000 }
  )
}

// WMI set property via PowerShell
export async function wmiSet(className: string, filter: string, properties: Record<string, string>): Promise<string> {
  const props = Object.entries(properties)
    .map(([k, v]) => `'${k}'='${v.replace(/'/g, "''")}'`)
    .join(';')
  return runCmd(
    `powershell -Command "Get-CimInstance ${className} -Filter \\"${filter.replace(/"/g, '\\"')}\\" | Set-CimInstance -Property @{${props}}"`,
    { timeout: 15000 }
  )
}

// WMI get via PowerShell
export async function wmiGet(className: string, filter: string, properties: string[]): Promise<string> {
  const props = properties.join(',')
  const f = filter ? ` -Filter "${filter.replace(/"/g, '\\"')}"` : ''
  return runCmd(
    `powershell -Command "Get-CimInstance ${className}${f} | Select-Object ${props} | ConvertTo-Csv -NoTypeInformation"`,
    { timeout: 15000 }
  )
}

// Parse PowerShell CSV output (ConvertTo-Csv format with headers)
// Returns array of header + data rows (first row is header)
export function parseCSV(csv: string): string[][] {
  const lines = csv.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  // Filter out non-data lines, keep quoted CSV lines
  return lines.filter(l => l.startsWith('"'))
    .map(l => l.split('","').map(s => s.replace(/^"|"$/g, '')))
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
export async function installPrinterViaPrintUI(infPath: string, printerName: string): Promise<string> {
  return runCmd(
    `rundll32 printui.dll,PrintUIEntry /il /f "${infPath}" /q /b "${printerName}"`,
    { timeout: 60000 }
  )
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
