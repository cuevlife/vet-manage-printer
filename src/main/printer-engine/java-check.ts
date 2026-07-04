import { runCmd, readRegistry, fileExists, killProcess } from './utils'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, unlinkSync, mkdirSync } from 'fs'

export async function checkJavaInstalled(): Promise<boolean> {
  try {
    const result = await runCmd('java -version 2>&1', { timeout: 5000 })
    if (result.toLowerCase().includes('version')) return true
  } catch {}

  const paths = [
    { key: 'HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment', value: 'CurrentVersion', subKey: true },
    { key: 'HKLM\\SOFTWARE\\Eclipse Adoptium\\JRE\\17', value: 'JavaHome', subKey: false },
    { key: 'HKLM\\SOFTWARE\\JavaSoft\\JRE', value: 'CurrentVersion', subKey: true }
  ]

  for (const p of paths) {
    try {
      if (p.subKey) {
        const version = await readRegistry(p.key, p.value)
        if (version) {
          const home = await readRegistry(`${p.key}\\${version}`, 'JavaHome')
          if (home) {
            const v = await runCmd(`"${home}\\bin\\java" -version 2>&1`, { timeout: 5000 })
            if (v.toLowerCase().includes('version')) return true
          }
        }
      } else {
        const home = await readRegistry(p.key, p.value)
        if (home) {
          const v = await runCmd(`"${home}\\bin\\java" -version 2>&1`, { timeout: 5000 })
          if (v.toLowerCase().includes('version')) return true
        }
      }
    } catch {}
  }

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
    const raw = await runCmd(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Product | Where-Object { \$_.Name -match 'Java|Adoptium|Temurin|OpenJDK' } | ForEach-Object { \$_.Uninstall() }"`,
      { timeout: 120000 }
    )
    return raw.length > 0
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
