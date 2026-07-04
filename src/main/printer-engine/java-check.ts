import { runCmd, readRegistry, fileExists, killProcess } from './utils'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'

export async function checkJavaInstalled(): Promise<boolean> {
  // Check registry first (more reliable for installed Java)
  const paths = [
    { key: 'HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment', value: 'CurrentVersion', subKey: true },
    { key: 'HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE\\17', value: 'JavaHome', subKey: false },
    { key: 'HKLM\\SOFTWARE\\JavaSoft\\JRE', value: 'CurrentVersion', subKey: true },
    { key: 'HKLM\\SOFTWARE\\Eclipse Adoptium\\JDK\\21', value: 'JavaHome', subKey: false }
  ]

  for (const p of paths) {
    try {
      if (p.subKey) {
        const version = await readRegistry(p.key, p.value)
        if (version) {
          const home = await readRegistry(`${p.key}\\${version}`, 'JavaHome')
          if (home && await runCmd(`"${home}\\bin\\java" -version 2>&1`, { timeout: 5000 }).then(r => r.toLowerCase().includes('version')).catch(() => false)) return true
        }
      } else {
        const home = await readRegistry(p.key, p.value)
        if (home && await runCmd(`"${home}\\bin\\java" -version 2>&1`, { timeout: 5000 }).then(r => r.toLowerCase().includes('version')).catch(() => false)) return true
      }
    } catch {}
  }

  // Fallback: check if java is in PATH but not in registry (portable install)
  try {
    const result = await runCmd('java -version 2>&1', { timeout: 5000 })
    if (result.toLowerCase().includes('version')) return true
  } catch {}

  return false
}

export async function installJava(): Promise<boolean> {
  try {
    if (await checkJavaInstalled()) return true

    const resourcePath = app.isPackaged
      ? join(process.resourcesPath, 'resources', 'drivers', 'SmartCard', 'java.exe')
      : join(app.getAppPath(), 'resources', 'drivers', 'SmartCard', 'java.exe')

    if (fileExists(resourcePath)) {
      await runCmd(`"${resourcePath}" /s ADDLOCAL=ALL`, { timeout: 120000 })
      return true
    }

    try {
      await runCmd(
        `powershell -Command "Invoke-WebRequest -Uri 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jre_x64_windows_hotspot_17.0.12_7.msi' -OutFile '%TEMP%\\java.msi'"`,
        { timeout: 120000 }
      )
      await runCmd(`msiexec /i "%TEMP%\\java.msi" /quiet /norestart`, { timeout: 120000 })
      return true
    } catch {
      return false
    }
  } catch {
    return false
  }
}

export async function uninstallJava(): Promise<boolean> {
  try {
    await killProcess('java.exe')
    await killProcess('javaw.exe')

    // Use PowerShell to find Java in registry and run its uninstaller
    const script = [
      '$found = $false',
      '$keys = @(',
      "  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',",
      "  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'",
      ')',
      'foreach ($base in $keys) {',
      '  Get-ChildItem $base -ErrorAction SilentlyContinue | ForEach-Object {',
      "    $name = $_.GetValue('DisplayName')",
      "    $uninstall = $_.GetValue('UninstallString')",
      "    if ($name -match 'Java|Adoptium|Temurin|OpenJDK' -and $uninstall) {",
      '      $found = $true',
      "      if ($uninstall -match '\\{([^}]+)\\}') {",
      "        Start-Process msiexec -ArgumentList '/x',$matches[1],'/quiet','/norestart' -Wait -NoNewWindow",
      "      } elseif ($uninstall -match '\"([^\"]+)\"') {",
      "        $exe = $matches[1]",
      "        $dir = Split-Path $exe -Parent",
      "        Start-Process $exe -ArgumentList '/S','/quiet' -WorkingDirectory $dir -Wait -NoNewWindow",
      '      }',
      '    }',
      '  }',
      '}',
      'if (-not $found) { Write-Output "NOT_FOUND" } else { Write-Output "UNINSTALLED" }'
    ].join('\n')
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const result = await runCmd(`powershell -NoProfile -EncodedCommand ${encoded}`, { timeout: 120000 })
    // Verify Java is actually gone
    return result.includes('UNINSTALLED') && !await checkJavaInstalled()
  } catch {
    return false
  }
}

export async function createVetManageShortcut(subdomain: string): Promise<void> {
  const url = `https://${subdomain}.vetmanage.co/login.php`
  const desktop = app.getPath('desktop')
  const startMenuDir = join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'VET MANAGE Printer Driver'
  )

  const iconPath = join(app.getPath('exe'), '..', 'app.ico')

  const shortcutContent = [
    '[InternetShortcut]',
    `URL=${url}`,
    `IconFile=${iconPath}`,
    'IconIndex=0'
  ].join('\r\n')

  writeFileSync(join(desktop, 'VET MANAGE.url'), shortcutContent, 'utf-8')

  mkdirSync(startMenuDir, { recursive: true })
  writeFileSync(join(startMenuDir, 'VET MANAGE Login.url'), shortcutContent, 'utf-8')
}

export async function removeVetManageShortcut(): Promise<void> {
  const desktop = app.getPath('desktop')
  const startMenuDir = join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'VET MANAGE Printer Driver'
  )

  try { unlinkSync(join(desktop, 'VET MANAGE.url')) } catch {}
  try { unlinkSync(join(startMenuDir, 'VET MANAGE Login.url')) } catch {}
}
