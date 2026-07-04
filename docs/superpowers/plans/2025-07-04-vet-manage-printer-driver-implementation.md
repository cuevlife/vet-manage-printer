# VET MANAGE Printer Driver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a beautiful Electron desktop app that installs, manages, and diagnoses VET MANAGE printer drivers, replacing the existing Inno Setup installer.

**Architecture:** Electron main process hosts a PrinterEngine (Node.js) that calls Windows native tools (pnputil, printui.dll, WMI, Registry) via child_process. React renderer communicates via IPC bridge. 4 pages: Dashboard, Install Wizard, Diagnostics, Settings.

**Tech Stack:** Electron 33+, React 18 + TypeScript, electron-vite, Tailwind CSS + Shadcn/ui, electron-builder, Lucide React icons.

**Design Spec:** `docs/superpowers/specs/2025-07-04-vet-manage-printer-driver-design.md`

## Global Constraints

- TypeScript throughout — no plain JS
- Driver files bundled in `resources/drivers/` (copy from `D:\Dev\ISS\drivers\`)
- VET MANAGE brand colors extracted from `Vet_Manage.png`
- Admin rights required for printer operations
- All printer logic in Node.js — no PowerShell scripts
- IPC bridge must be promise-based with error handling

---

## File Structure

```
src/
├── main/
│   ├── index.ts                    # Main process entry, BrowserWindow
│   ├── ipc-handlers.ts            # IPC channel registration
│   ├── printer-engine/
│   │   ├── types.ts               # Shared interfaces/types
│   │   ├── index.ts               # PrinterEngine class (orchestrator)
│   │   ├── usb-detection.ts       # 8-method USB port detection
│   │   ├── driver-install.ts      # Install/uninstall via pnputil + printui
│   │   ├── diagnostics.ts         # DiagnosticReport builder
│   │   └── java-check.ts          # Java detection/install for SmartCard
│   └── preload.ts                 # contextBridge API exposure
├── renderer/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css              # Tailwind directives + theme vars
│   │   ├── lib/
│   │   │   └── ipc.ts             # Typed IPC invoke wrappers
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── InstallWizard.tsx
│   │   │   ├── Diagnostics.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── StatusCard.tsx
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── ConnectionForm.tsx
│   │   │   ├── ProgressLog.tsx
│   │   │   ├── DiagnosticCard.tsx
│   │   │   └── Layout.tsx
│   │   └── hooks/
│   │       └── use-printer.ts
├── resources/
│   └── drivers/                    # Driver files at build time
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.ts
└── components.json                 # Shadcn config
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `components.json`
- Create: `src/main/index.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/index.css`
- Create: `electron-builder.yml`
- Create: `src/renderer/src/env.d.ts`

**Interfaces:**
- Produces: Empty Electron app with React, Tailwind, Shadcn ready

- [ ] **Step 1: Initialize project with package.json**

```json
{
  "name": "vet-manage-printer-driver",
  "version": "1.0.0",
  "description": "VET MANAGE Printer Driver Installer & Manager",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.441.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toast": "^1.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.14.0",
    "electron": "^33.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

- [ ] **Step 2: Create tsconfig files**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/main/*", "vite.config.ts"]
}
```

`tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ESNext",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/renderer/**/*", "src/renderer/*"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwind from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwind, autoprefixer]
      }
    },
    build: {
      outDir: 'dist/renderer'
    }
  }
})
```

- [ ] **Step 4: Create Tailwind + PostCSS config**

`tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        accent: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
```

`postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/renderer/src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "src/renderer/src/components",
    "utils": "src/renderer/src/lib/utils",
    "ui": "src/renderer/src/components/ui",
    "lib": "src/renderer/src/lib",
    "hooks": "src/renderer/src/hooks"
  }
}
```

- [ ] **Step 5: Create main process entry**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    frame: false,
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  registerIpcHandlers()

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 6: Create preload script**

`src/main/preload.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

`src/renderer/src/env.d.ts`:
```typescript
/// <reference types="vite/client" />

interface ElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
```

- [ ] **Step 7: Create renderer entry files**

`src/renderer/index.html`:
```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VET MANAGE Printer Driver</title>
</head>
<body class="bg-gray-50">
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>
</body>
</html>
```

`src/renderer/src/main.tsx`:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/renderer/src/App.tsx`:
```typescript
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import InstallWizard from './pages/InstallWizard'
import Diagnostics from './pages/Diagnostics'
import Settings from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/install" element={<InstallWizard />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
```

`src/renderer/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 142 76% 36%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 142 76% 36%;
    --radius: 0.5rem;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* Title bar drag region */
.titlebar {
  -webkit-app-region: drag;
}
.titlebar button, .titlebar a {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 8: Create electron-builder.yml**

```yaml
appId: com.vetmanage.printer-driver
productName: VET MANAGE Printer Driver
directories:
  output: release
files:
  - dist/**/*
  - resources/**/*
extraResources:
  - from: resources/
    to: resources/
    filter:
      - "**/*"
win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico
  requestedExecutionLevel: requireAdministrator
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
  installerHeaderIcon: resources/icon.ico
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: VET MANAGE Printer Driver
```

- [ ] **Step 9: Install dependencies and verify build**

```bash
cd D:\windowproject\printerdriver
npm install
npx electron-vite build
```
Expected: Build succeeds, `dist/` directory created with main, preload, renderer subdirectories.

- [ ] **Step 10: Copy driver files**

```bash
Copy-Item -Path "D:\Dev\ISS\drivers\label" -Destination "D:\windowproject\printerdriver\resources\drivers\label" -Recurse -Force
Copy-Item -Path "D:\Dev\ISS\drivers\bill" -Destination "D:\windowproject\printerdriver\resources\drivers\bill" -Recurse -Force
Copy-Item -Path "D:\Dev\ISS\drivers\SmartCard" -Destination "D:\windowproject\printerdriver\resources\drivers\SmartCard" -Recurse -Force -Exclude "java.exe"
Copy-Item -Path "D:\Dev\ISS\app.ico" -Destination "D:\windowproject\printerdriver\resources\icon.ico" -Force
```

- [ ] **Step 11: Commit scaffolding**

```bash
git init
git add .
git commit -m "feat: scaffold Electron + React + Tailwind project"
```

---

### Task 2: Printer Engine Types & Utilities

**Files:**
- Create: `src/main/printer-engine/types.ts`
- Create: `src/main/printer-engine/utils.ts`

**Interfaces:**
- Produces: All shared type definitions + Windows utility functions consumed by Tasks 3-7

- [ ] **Step 1: Create types.ts**

`src/main/printer-engine/types.ts`:
```typescript
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
    driverName: 'AUTO',
    configDatPath: 'resources\\drivers\\label\\VetLabelConfig.dat'
  },
  bill: {
    printerName: 'VET Bill',
    printerType: 'bill',
    infPath: 'resources\\drivers\\bill\\Windows x64\\XPDRVx64.INF',
    driverName: 'AUTO',
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
```

- [ ] **Step 2: Create utils.ts** (Windows native call helpers)

`src/main/printer-engine/utils.ts`:
```typescript
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

// WMI query helper
export async function wmiQuery(query: string): Promise<string> {
  return runCmd(`wmic ${query} /FORMAT:CSV 2>nul`, { timeout: 10000 })
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
```

- [ ] **Step 3: Create and run a basic typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/printer-engine/
git commit -m "feat: add printer engine types and Windows utility functions"
```

---

### Task 3: USB Port Detection (8-Method Algorithm)

**Files:**
- Create: `src/main/printer-engine/usb-detection.ts`

**Interfaces:**
- Consumes: `USBDevice` type, `wmiQuery()`, `readRegistry()`, `enumRegistryKeys()` from Task 2
- Produces: `detectUSBPorts(type: 'label' | 'bill'): Promise<USBDevice | null>` and `listAllUSBDevices(): Promise<USBDevice[]>`

- [ ] **Step 1: Create usb-detection.ts**

```typescript
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
  const raw = await wmiQuery('path Win32_PnPEntity WHERE (PNPClass = "USB" OR PNPClass = "System") GET DeviceID,PNPDeviceID,Status,Caption /VALUE')
  // Parse CSV output
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))
  
  // Each CSV line: Node,DeviceID,PNPDeviceID,Status,Caption
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length < 5) continue
    const deviceId = parts[1]?.trim() || ''
    const pnpId = parts[2]?.trim() || ''
    const status = parts[3]?.trim() || ''
    const caption = parts[4]?.trim() || ''
    
    if (status !== 'OK') continue
    
    // Extract VID from PNPDeviceID
    const vidMatch = pnpId.match(/VID_([0-9A-F]{4})/i)
    const pidMatch = pnpId.match(/PID_([0-9A-F]{4})/i)
    const vid = vidMatch ? vidMatch[1] : ''
    const pid = pidMatch ? pidMatch[1] : ''
    
    // Look for USBPRINT in device chain
    const isUSBPrint = pnpId.includes('USBPRINT')
    
    devices.push({
      portName: '',
      vid,
      pid,
      model: caption || pnpId,
      isActive: status === 'OK',
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
```

- [ ] **Step 2: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/printer-engine/usb-detection.ts
git commit -m "feat: implement 8-method USB port detection algorithm"
```

---

### Task 4: Driver Install/Uninstall Engine

**Files:**
- Create: `src/main/printer-engine/driver-install.ts`

**Interfaces:**
- Consumes: `PrinterConfig`, `InstallProgress`, `InstallResult`, `detectUSBPort()`, utility functions from Tasks 2-3
- Produces: `installPrinter(config, onProgress): Promise<InstallResult>`, `uninstallPrinter(printerName): Promise<InstallResult>`, `cleanupAllPrinters(): Promise<void>`

- [ ] **Step 1: Create driver-install.ts**

```typescript
import { PrinterConfig, InstallProgress, InstallResult, ComponentType, PRINTER_DEFINITIONS } from './types'
import { detectUSBPort } from './usb-detection'
import {
  addDriverViaPnputil, installPrinterViaPrintUI, removePrinterViaPrintUI,
  createTCPIPPort, runCmd, fileExists, removeDriverViaPnputil
} from './utils'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

type ProgressCallback = (progress: InstallProgress) => void

function getResourcePath(relativePath: string): string {
  // In dev: relative to project root, in prod: extraResources dir
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

    // Resolve paths
    const infPath = getResourcePath(config.infPath.replace('resources\\', ''))
    const configDatPath = config.configDatPath ? getResourcePath(config.configDatPath.replace('resources\\', '')) : ''

    if (!existsSync(infPath)) {
      throw new Error(`ไม่พบไฟล์ driver: ${infPath}`)
    }

    // USB mode: detect port
    let portName = config.ipAddress ? `IP_${config.ipAddress}` : ''
    if (config.connectionType === 'USB') {
      progress('usb-detect', 20, 'กำลังตรวจสอบพอร์ต USB...')
      
      // Try matching printer type
      const usbDevice = await detectUSBPort(component)
      if (usbDevice && usbDevice.portName) {
        portName = usbDevice.portName
      } else {
        // Try any USBPRINT port
        const { listAllUSBDevices } = await import('./usb-detection')
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

    // LAN mode: create TCP/IP port
    if (config.connectionType === 'LAN' && config.ipAddress) {
      progress('lan-port', 30, `กำลังสร้างพอร์ต LAN: ${portName}...`)
      await createTCPIPPort(config.ipAddress, portName!)
    }

    // Add driver via pnputil
    progress('add-driver', 40, 'กำลังเพิ่ม driver ลงในระบบ...')
    try {
      await addDriverViaPnputil(infPath)
    } catch (err: any) {
      // pnputil may return non-zero for "already installed" — that's OK
      if (!err.message.includes('0x800b0109')) { // cert error is OK too
        progress('add-driver', 45, 'driver อาจมีอยู่แล้ว ดำเนินการต่อ...')
      }
    }

    // Install printer via printui.dll
    progress('install-printer', 60, `กำลังติดตั้ง ${config.printerName}...`)
    await installPrinterViaPrintUI(infPath, config.printerName)

    // Configure port
    if (portName) {
      progress('config-port', 75, `กำลังตั้งค่าพอร์ต ${portName}...`)
      await runCmd(
        `wmic path Win32_Printer WHERE Name="${config.printerName}" SET PortName="${portName}" 2>nul`
      )
    }

    // Restore config
    if (configDatPath && existsSync(configDatPath)) {
      progress('restore-config', 85, 'กำลังกู้คืนการตั้งค่า...')
      await runCmd(
        `wmic path Win32_Printer WHERE Name="${config.printerName}" SET ConfigFile="${configDatPath}" 2>nul`
      )
    }

    // Set as default if applicable
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
    // Remove printer
    await removePrinterViaPrintUI(printerName)
    
    // Also remove matching Print Processor and Monitor references
    await runCmd(
      `wmic path Win32_Printer WHERE Name="${printerName}" DELETE 2>nul`
    )

    return { component, success: true }
  } catch (err: any) {
    return { component, success: false, error: err.message }
  }
}

export async function cleanupAllPrinters(): Promise<void> {
  // Remove all Xprinter/XP/4BARCODE printers
  const printers = await runCmd(
    `wmic path Win32_Printer WHERE "Name LIKE '%VET%' OR Name LIKE '%Label%' OR Name LIKE '%Bill%' OR Name LIKE '%Xprinter%' OR Name LIKE '%XP-%'" GET Name /FORMAT:CSV 2>nul`
  )
  const lines = printers.split('\n').map(l => l.trim()).filter(l => l.includes(',') && !l.startsWith('Node'))
  for (const line of lines) {
    const parts = line.split(',')
    if (parts.length >= 2) {
      const name = parts[1].trim()
      if (name) {
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
        const { killProcess } = await import('./utils')
        await killProcess('java.exe')
        await killProcess('javaw.exe')
        progress('removing', 50, 'กำลังลบไฟล์ SmartCard...')
        const { execSync } = require('child_process')
        const smartCardPath = join(app.getPath('exe'), '..', 'Drivers', 'SmartCard')
        execSync(`rmdir /s /q "${smartCardPath}"`, { windowsHide: true })
        break
      }
      case 'vetmanage':
        progress('removing', 50, 'กำลังลบ Shortcut VET MANAGE...')
        const desktop = app.getPath('desktop')
        const startMenu = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
        // Remove .url files
        const { unlinkSync } = await import('fs')
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
```

- [ ] **Step 2: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/printer-engine/driver-install.ts
git commit -m "feat: implement printer install/uninstall engine"
```

---

### Task 5: Diagnostics Engine

**Files:**
- Create: `src/main/printer-engine/diagnostics.ts`

**Interfaces:**
- Consumes: `DiagnosticReport`, `PrinterDiagnostic`, `SmartCardDiagnostic`, detection functions from Tasks 2-4
- Produces: `runDiagnostics(): Promise<DiagnosticReport>`, `fixByReport(report: DiagnosticReport): Promise<InstallResult[]>`

- [ ] **Step 1: Create diagnostics.ts**

```typescript
import { DiagnosticReport, PrinterDiagnostic, SmartCardDiagnostic, USBDevice, PRINTER_DEFINITIONS } from './types'
import { listAllUSBDevices, detectUSBPort } from './usb-detection'
import { installPrinter, cleanupAllPrinters } from './driver-install'
import { runCmd, readRegistry } from './utils'
import { InstallResult } from './types'

async function checkPrinter(printerName: string): Promise<PrinterDiagnostic> {
  const details: string[] = []
  
  const raw = await runCmd(
    `wmic path Win32_Printer WHERE Name="${printerName}" GET Name,DriverName,PortName,PrinterStatus,WorkOffline /FORMAT:CSV 2>nul`
  )

  const installed = raw.includes(printerName)
  
  if (!installed) {
    details.push(`❌ ไม่พบ ${printerName} ในระบบ`)
    return { installed: false, connected: false, driverOk: false, portConfigured: false, printerOnline: false, details }
  }

  details.push(`✅ ${printerName} มีในระบบ`)

  // Check port
  const portMatch = raw.match(/,([^,]+),([^,]+),(\d+),(\d+)/)
  const portName = portMatch?.[1]?.trim() || ''
  const driverName = portMatch?.[2]?.trim() || ''
  const printerStatus = parseInt(portMatch?.[3] || '0')
  const workOffline = parseInt(portMatch?.[4] || '0')

  const hasPort = portName.length > 0
  if (hasPort) {
    details.push(`✅ พอร์ต: ${portName}`)
  } else {
    details.push(`⚠️ ไม่พบพอร์ต`)
  }

  // Check driver
  const driverOk = driverName.length > 0
  if (driverOk) {
    details.push(`✅ Driver: ${driverName}`)
  } else {
    details.push(`❌ ไม่พบ Driver`)
  }

  // Printer status (3=idle, 4=printing, others=error)
  const isOnline = workOffline === 0
  const statusMap: Record<number, string> = {
    0: 'พร้อมใช้งาน',
    1: 'หยุดชั่วคราว', 2: 'กำลังพิมพ์',
    3: 'ว่าง', 4: 'กำลังพิมพ์',
    5: 'รอ'
  }
  const statusStr = statusMap[printerStatus] || `สถานะ ${printerStatus}`
  details.push(`${isOnline ? '✅' : '❌'} สถานะ: ${statusStr}`)
  details.push(`🔌 Offline mode: ${workOffline === 1 ? 'ใช่ (⚠️)' : 'ไม่'}`)

  return {
    installed: true,
    connected: hasPort,
    driverOk,
    portConfigured: hasPort,
    printerOnline: isOnline,
    details
  }
}

async function checkJava(): Promise<SmartCardDiagnostic> {
  const details: string[] = []

  // Check Java via PATH
  let javaFound = false
  try {
    const javaVersion = await runCmd('java -version 2>&1', { timeout: 5000 })
    javaFound = javaVersion.toLowerCase().includes('version')
    if (javaFound) details.push('✅ พบ Java ใน PATH')
  } catch {
    javaFound = false
  }

  if (!javaFound) {
    // Check registry
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

    // Check Eclipse Adoptium
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

  // USB devices
  const usbDevices = await listAllUSBDevices()
  const usbStatus = usbDevices.length > 0 ? 'ok' : 'warning'
  const usbMessage = usbDevices.length > 0
    ? `พบอุปกรณ์ USB ${usbDevices.length} ตัว`
    : '⚠️ ไม่พบอุปกรณ์ USB ที่เชื่อมต่ออยู่'

  if (usbDevices.length === 0) {
    recommendations.push('เสียบสาย USB เครื่องพิมพ์และเปิดเครื่อง แล้วกดตรวจสอบอีกครั้ง')
  }

  // Check printers
  const label = await checkPrinter('VET Label')
  const bill = await checkPrinter('VET Bill')
  const smartcard = await checkJava()

  if (!label.installed) recommendations.push('ติดตั้ง VET Label (เครื่องพิมพ์ฉลาก)')
  if (label.installed && !label.printerOnline) recommendations.push('ตรวจสอบการเชื่อมต่อ VET Label — เปิดเครื่องหรือตรวจสอบสาย USB/LAN')
  
  if (!bill.installed) recommendations.push('ติดตั้ง VET Bill (เครื่องพิมพ์ใบเสร็จ)')
  if (bill.installed && !bill.printerOnline) recommendations.push('ตรวจสอบการเชื่อมต่อ VET Bill')
  
  if (!smartcard.javaInstalled) recommendations.push('ติดตั้ง Java Runtime Environment สำหรับ SmartCard')

  const issues = [label, bill].filter(d => d.installed && !d.printerOnline).length
  const critical = [label, bill].filter(d => !d.installed).length

  const overall = critical > 0 ? 'critical' : issues > 0 ? 'has_issues' : 'healthy'

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

  // Fix printers that are missing or broken
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
```

- [ ] **Step 2: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/printer-engine/diagnostics.ts
git commit -m "feat: implement diagnostic engine with fix capability"
```

---

### Task 6: SmartCard Java Check & VET MANAGE Shortcut

**Files:**
- Create: `src/main/printer-engine/java-check.ts`

**Interfaces:**
- Consumes: utility functions from Task 2
- Produces: `checkJavaInstalled(): Promise<boolean>`, `installJava(): Promise<boolean>`, `createVetManageShortcut(subdomain: string): Promise<void>`

- [ ] **Step 1: Create java-check.ts**

```typescript
import { runCmd, readRegistry, fileExists, killProcess } from './utils'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'

export async function checkJavaInstalled(): Promise<boolean> {
  try {
    const result = await runCmd('java -version 2>&1', { timeout: 5000 })
    if (result.toLowerCase().includes('version')) return true
  } catch {}

  // Check registry paths
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

  // Check Program Files
  const pfPaths = [
    `${process.env['ProgramFiles']}\\Eclipse Adoptium\\jre-*\\bin\\java.exe`,
    `${process.env['ProgramFiles']}\\Java\\*\\bin\\java.exe`,
    `${process.env['ProgramFiles(x86)']}\\Java\\*\\bin\\java.exe`
  ]

  for (const pattern of pfPaths) {
    try {
      const result = await runCmd(`dir /b "${pattern}" 2>nul`, { timeout: 5000 })
      if (result.trim()) return true
    } catch {}
  }

  return false
}

export async function installJava(): Promise<boolean> {
  try {
    // Download Java 17 (Adoptium/Temurin) silently
    // Try installed Java first
    if (await checkJavaInstalled()) return true

    // Use the bundled Java installer if available
    const resourcePath = app.isPackaged
      ? join(process.resourcesPath, 'resources', 'drivers', 'SmartCard', 'java.exe')
      : join(app.getAppPath(), 'resources', 'drivers', 'SmartCard', 'java.exe')

    if (fileExists(resourcePath)) {
      await runCmd(`"${resourcePath}" /s ADDLOCAL=ALL`, { timeout: 120000 })
      return true
    }

    // Fallback: download from internet
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

  // Desktop shortcut
  writeFileSync(join(desktop, 'VET MANAGE.url'), shortcutContent, 'utf-8')

  // Start Menu shortcut
  const { mkdirSync } = await import('fs')
  try { mkdirSync(startMenuDir, { recursive: true }) } catch {}
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

  const { unlinkSync } = await import('fs')
  try { unlinkSync(join(desktop, 'VET MANAGE.url')) } catch {}
  try { unlinkSync(join(startMenuDir, 'VET MANAGE Login.url')) } catch {}
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/printer-engine/java-check.ts
git commit -m "feat: add Java detection, install, and VET MANAGE shortcut creation"
```

---

### Task 7: Printer Engine Index & IPC Bridge

**Files:**
- Create: `src/main/printer-engine/index.ts`
- Create: `src/main/ipc-handlers.ts`

**Interfaces:**
- Consumes: All printer engine modules from Tasks 2-6
- Produces: IPC handlers exposed to renderer via preload

- [ ] **Step 1: Create printer-engine/index.ts**

```typescript
export * from './types'
export { detectUSBPort, listAllUSBDevices } from './usb-detection'
export { installPrinter, uninstallPrinter, cleanupAllPrinters, uninstallComponent, testPrint } from './driver-install'
export { runDiagnostics, fixByReport } from './diagnostics'
export { checkJavaInstalled, installJava, createVetManageShortcut, removeVetManageShortcut } from './java-check'
```

- [ ] **Step 2: Create ipc-handlers.ts**

```typescript
import { ipcMain } from 'electron'
import {
  listAllUSBDevices, detectUSBPort,
  installPrinter, uninstallPrinter, uninstallComponent, testPrint,
  runDiagnostics, fixByReport,
  checkJavaInstalled, installJava, createVetManageShortcut, removeVetManageShortcut,
  PRINTER_DEFINITIONS, InstallProgress, ConnectionType, ComponentType, InstallResult
} from './printer-engine'

export function registerIpcHandlers() {
  // ── USB Detection ──
  ipcMain.handle('detect:list-ports', async () => {
    return listAllUSBDevices()
  })

  ipcMain.handle('detect:port-for-type', async (_event, type: 'label' | 'bill') => {
    return detectUSBPort(type)
  })

  // ── Diagnostics ──
  ipcMain.handle('diagnostics:run', async () => {
    return runDiagnostics()
  })

  ipcMain.handle('diagnostics:fix', async (_event, report: any) => {
    return fixByReport(report)
  })

  // ── Install ──
  ipcMain.handle('install:printer', async (
    _event,
    component: ComponentType,
    connectionType: ConnectionType,
    ipAddress?: string
  ): Promise<InstallResult> => {
    const def = PRINTER_DEFINITIONS[component]
    if (!def) return { component, success: false, error: `Unknown component: ${component}` }
    return installPrinter({
      ...def,
      connectionType,
      ipAddress
    }, (progress: InstallProgress) => {
      // Send progress to renderer
      const windows = require('electron').BrowserWindow.getAllWindows()
      windows.forEach((w: any) => w.webContents.send('install:progress', progress))
    })
  })

  ipcMain.handle('install:smartcard', async (): Promise<InstallResult> => {
    try {
      const javaOk = await checkJavaInstalled()
      if (!javaOk) {
        const installed = await installJava()
        if (!installed) return { component: 'smartcard', success: false, error: 'ติดตั้ง Java ไม่สำเร็จ' }
      }
      return { component: 'smartcard', success: true }
    } catch (err: any) {
      return { component: 'smartcard', success: false, error: err.message }
    }
  })

  ipcMain.handle('install:shortcut', async (_event, subdomain: string): Promise<InstallResult> => {
    try {
      await createVetManageShortcut(subdomain)
      return { component: 'vetmanage', success: true }
    } catch (err: any) {
      return { component: 'vetmanage', success: false, error: err.message }
    }
  })

  // ── Uninstall ──
  ipcMain.handle('uninstall:printer', async (_event, printerName: string) => {
    return uninstallPrinter(printerName)
  })

  ipcMain.handle('uninstall:component', async (
    _event,
    component: ComponentType
  ) => {
    if (component === 'vetmanage') {
      await removeVetManageShortcut()
      return { component, success: true } as InstallResult
    }
    return uninstallComponent(component)
  })

  // ── Test Print ──
  ipcMain.handle('printer:test-print', async (_event, printerName: string) => {
    return testPrint(printerName)
  })

  // ── Java ──
  ipcMain.handle('java:check', async () => {
    return checkJavaInstalled()
  })

  ipcMain.handle('java:install', async () => {
    return installJava()
  })
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.node.json
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/main/
git commit -m "feat: wire up PrinterEngine with IPC handlers"
```

---

### Task 8: IPC Client Wrapper & Shared UI Library

**Files:**
- Create: `src/renderer/src/lib/ipc.ts`
- Create: `src/renderer/src/lib/utils.ts` (shadcn utility)
- Create: `src/renderer/src/components/ui/*.tsx` (shadcn components used across pages)

**Interfaces:**
- Consumes: Task 1 scaffold + Task 7 IPC handlers
- Produces: Typed IPC client + reusable UI components

- [ ] **Step 1: Create lib/ipc.ts**

```typescript
import type { USBDevice, DiagnosticReport, InstallResult, InstallProgress, ComponentType, ConnectionType } from '../../../main/printer-engine/types'

const api = window.electronAPI

export const printerApi = {
  // USB Detection
  listPorts: () => api.invoke('detect:list-ports') as Promise<USBDevice[]>,
  detectPortForType: (type: 'label' | 'bill') => api.invoke('detect:port-for-type', type) as Promise<USBDevice | null>,

  // Diagnostics
  runDiagnostics: () => api.invoke('diagnostics:run') as Promise<DiagnosticReport>,
  fixByReport: (report: DiagnosticReport) => api.invoke('diagnostics:fix', report) as Promise<InstallResult[]>,

  // Install
  installPrinter: (component: ComponentType, connectionType: ConnectionType, ipAddress?: string) =>
    api.invoke('install:printer', component, connectionType, ipAddress) as Promise<InstallResult>,
  installSmartCard: () => api.invoke('install:smartcard') as Promise<InstallResult>,
  installShortcut: (subdomain: string) => api.invoke('install:shortcut', subdomain) as Promise<InstallResult>,

  // Uninstall
  uninstallPrinter: (printerName: string) => api.invoke('uninstall:printer', printerName) as Promise<InstallResult>,
  uninstallComponent: (component: ComponentType) => api.invoke('uninstall:component', component) as Promise<InstallResult>,

  // Test Print
  testPrint: (printerName: string) => api.invoke('printer:test-print', printerName) as Promise<string>,

  // Java
  checkJava: () => api.invoke('java:check') as Promise<boolean>,
  installJava: () => api.invoke('java:install') as Promise<boolean>,

  // Events
  onInstallProgress: (callback: (progress: InstallProgress) => void) => api.on('install:progress', callback)
}
```

- [ ] **Step 2: Create lib/utils.ts**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Create shadcn UI components**

```bash
cd D:\windowproject\printerdriver
npx --yes shadcn@latest add button card progress separator toast -y
```
Or manually create the minimal components needed.

`src/renderer/src/components/ui/button.tsx`:
```typescript
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white shadow hover:bg-brand-700',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        outline: 'border border-input bg-white shadow-sm hover:bg-accent-50',
        secondary: 'bg-accent-100 text-accent-900 shadow-sm hover:bg-accent-200',
        ghost: 'hover:bg-accent-50 hover:text-accent-900',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

`src/renderer/src/components/ui/card.tsx`:
```typescript
import * as React from 'react'
import { cn } from '../../lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-xl border bg-white shadow-sm', className)} {...props} />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

`src/renderer/src/components/ui/separator.tsx`:
```typescript
import * as React from 'react'
import { cn } from '../../lib/utils'

const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('h-px bg-border', className)} {...props} />
  )
)
Separator.displayName = 'Separator'

export { Separator }
```

- [ ] **Step 4: Run typecheck**

```bash
cd D:\windowproject\printerdriver
npx tsc --noEmit -p tsconfig.web.json
```
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/ src/renderer/src/components/ui/
git commit -m "feat: add IPC client wrapper and UI components"
```

---

### Task 9: UI — Layout & Components

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/Layout.tsx`
- Create: `src/renderer/src/components/Logo.tsx`
- Create: `src/renderer/src/components/StatusCard.tsx`
- Create: `src/renderer/src/hooks/use-printer.ts`

**Interfaces:**
- Consumes: Task 8 IPC client
- Produces: Shared layout, navigation, status card component, and data hook

- [ ] **Step 1: Create Layout.tsx**

`src/renderer/src/components/Layout.tsx`:
```typescript
import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Printer, Wrench, Settings, Home } from 'lucide-react'
import Logo from './Logo'
import { cn } from '../lib/utils'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/install', icon: Printer, label: 'ติดตั้ง' },
  { to: '/diagnostics', icon: Wrench, label: 'ตรวจสอบ' },
  { to: '/settings', icon: Settings, label: 'ตั้งค่า' },
]

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Title Bar */}
      <div className="titlebar fixed top-0 left-0 right-0 h-8 bg-brand-700 flex items-center justify-center z-50">
        <span className="text-white text-xs font-medium">VET MANAGE Printer Driver</span>
      </div>

      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 pt-8 flex flex-col">
        <div className="p-4">
          <Logo />
        </div>
        <Separator className="mx-4" />
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">VET MANAGE v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pt-8 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create Logo.tsx**

`src/renderer/src/components/Logo.tsx`:
```typescript
export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      <div>
        <h2 className="text-sm font-bold text-brand-800 leading-tight">VET MANAGE</h2>
        <p className="text-[10px] text-gray-400 leading-tight">Printer Driver</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create StatusCard.tsx**

`src/renderer/src/components/StatusCard.tsx`:
```typescript
import { ReactNode } from 'react'
import { CheckCircle2, AlertCircle, XCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { cn } from '../lib/utils'

type Status = 'ok' | 'warning' | 'error' | 'loading' | 'idle'

interface StatusCardProps {
  title: string
  subtitle?: string
  status: Status
  actions?: ReactNode
  details?: string[]
}

const statusConfig = {
  ok: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  loading: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  idle: { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
}

export default function StatusCard({ title, subtitle, status, actions, details }: StatusCardProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Card className={cn('border-2', config.bg)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Icon className={cn('mt-0.5', config.color, status === 'loading' && 'animate-spin')} size={20} />
            <div>
              <h4 className="font-semibold text-sm">{title}</h4>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
              {details && details.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {details.map((d, i) => (
                    <li key={i} className="text-xs text-gray-600">{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {actions && <div className="flex gap-2 shrink-0 ml-4">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export type { Status }
```

- [ ] **Step 4: Create use-printer hook**

`src/renderer/src/hooks/use-printer.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react'
import { printerApi } from '../lib/ipc'
import type { DiagnosticReport, InstallProgress } from '../../main/printer-engine/types'

export function useDiagnostics() {
  const [report, setReport] = useState<DiagnosticReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await printerApi.runDiagnostics()
      setReport(result)
    } catch (err: any) {
      setError(err.message || 'การตรวจสอบล้มเหลว')
    } finally {
      setLoading(false)
    }
  }, [])

  const fix = useCallback(async () => {
    if (!report) return null
    setLoading(true)
    try {
      const results = await printerApi.fixByReport(report)
      await run() // Re-run diagnostics
      return results
    } catch (err: any) {
      setError(err.message || 'การซ่อมล้มเหลว')
      return null
    } finally {
      setLoading(false)
    }
  }, [report, run])

  return { report, loading, error, run, fix }
}

export function useInstallProgress() {
  const [progress, setProgress] = useState<InstallProgress | null>(null)

  useEffect(() => {
    const unsub = printerApi.onInstallProgress(setProgress)
    return unsub
  }, [])

  return progress
}
```

- [ ] **Step 5: Verify build**

```bash
cd D:\windowproject\printerdriver
npx electron-vite build
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/ src/renderer/src/hooks/
git commit -m "feat: add Layout, StatusCard, Logo components and data hooks"
```

---

### Task 10: UI — Dashboard Page

**Files:**
- Create: `src/renderer/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `StatusCard`, `useDiagnostics`, `printerApi` from Tasks 8-9
- Produces: Home page showing 4 component status cards + quick actions

- [ ] **Step 1: Create Dashboard.tsx**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wrench, Printer, Smartphone, Globe } from 'lucide-react'
import StatusCard from '../components/StatusCard'
import { Button } from '../components/ui/button'
import { useDiagnostics } from '../hooks/use-printer'
import type { Status } from '../components/StatusCard'

function statusFrom<T>(value: T, okValue: T): Status {
  return value === okValue ? 'ok' : value === undefined ? 'idle' : 'error'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { report, loading, run } = useDiagnostics()
  const [scanDone, setScanDone] = useState(false)

  useEffect(() => {
    run().then(() => setScanDone(true))
  }, [run])

  const overallColor = report?.overall === 'healthy' ? 'bg-green-600' : report?.overall === 'has_issues' ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">สถานะระบบ Printer Driver</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run()} disabled={loading}>
            <Wrench size={16} className="mr-2" />
            ตรวจสอบอีกครั้ง
          </Button>
          <Button onClick={() => navigate('/install')}>
            <Plus size={16} className="mr-2" />
            เพิ่ม Printer
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      {scanDone && report && (
        <div className={`rounded-xl p-4 text-white ${overallColor} flex items-center justify-between`}>
          <div>
            <p className="text-lg font-bold">
              {report.overall === 'healthy' ? '✅ ระบบพร้อมใช้งาน' : report.overall === 'has_issues' ? '⚠️ มีปัญหาบางอย่าง' : '❌ จำเป็นต้องแก้ไข'}
            </p>
            <p className="text-sm opacity-90">
              USB: {report.usb.devices.length} ตัว | Label: {report.label.installed ? '✅' : '❌'} | Bill: {report.bill.installed ? '✅' : '❌'}
            </p>
          </div>
          {report.recommendations.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/diagnostics')}>
              {report.recommendations.length} รายการที่ต้องดำเนินการ
            </Button>
          )}
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusCard
          title="VET Label"
          subtitle="เครื่องพิมพ์ฉลากยา (Xprinter TSC)"
          status={report ? statusFrom(report.label.installed, true) : 'loading'}
          details={report?.label.details}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => printerApi.testPrint('VET Label').catch(() => {})}>
                ทดสอบพิมพ์
              </Button>
              <Button size="sm" onClick={() => navigate('/install')}>
                {report?.label.installed ? 'ซ่อม' : 'ติดตั้ง'}
              </Button>
            </>
          }
        />

        <StatusCard
          title="VET Bill"
          subtitle="เครื่องพิมพ์ใบเสร็จ (XP-80)"
          status={report ? statusFrom(report.bill.installed, true) : 'loading'}
          details={report?.bill.details}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => printerApi.testPrint('VET Bill').catch(() => {})}>
                ทดสอบพิมพ์
              </Button>
              <Button size="sm" onClick={() => navigate('/install')}>
                {report?.bill.installed ? 'ซ่อม' : 'ติดตั้ง'}
              </Button>
            </>
          }
        />

        <StatusCard
          title="SmartCard"
          subtitle="เครื่องอ่านบัตรประชาชน"
          status={report ? statusFrom(report.smartcard.javaInstalled, true) : 'loading'}
          details={report?.smartcard.details}
        />

        <StatusCard
          title="VET MANAGE"
          subtitle="Shortcut เข้าระบบ"
          status={report?.label.installed || report?.bill.installed ? 'ok' : 'idle'}
          details={['สร้าง Shortcut ลิงก์ไปยังระบบ VET MANAGE']}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd D:\windowproject\printerdriver
npx electron-vite build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/Dashboard.tsx
git commit -m "feat: add Dashboard page with status cards"
```

---

### Task 11: UI — Install Wizard Page

**Files:**
- Create: `src/renderer/src/pages/InstallWizard.tsx`
- Create: `src/renderer/src/components/StepIndicator.tsx`
- Create: `src/renderer/src/components/ConnectionForm.tsx`
- Create: `src/renderer/src/components/ProgressLog.tsx`

**Interfaces:**
- Consumes: `printerApi`, `useInstallProgress` from Tasks 8-9
- Produces: Multi-step installation wizard

- [ ] **Step 1: Create StepIndicator.tsx**

`src/renderer/src/components/StepIndicator.tsx`:
```typescript
import { cn } from '../lib/utils'

interface StepIndicatorProps {
  steps: string[]
  currentStep: number
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            i === currentStep ? 'bg-brand-600 text-white' : i < currentStep ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-400'
          )}>
            <span className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              i === currentStep ? 'bg-white/20' : i < currentStep ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
            )}>
              {i + 1}
            </span>
            {label}
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200" />}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create ConnectionForm.tsx**

`src/renderer/src/components/ConnectionForm.tsx`:
```typescript
import { useState } from 'react'
import type { ConnectionType } from '../../main/printer-engine/types'

interface ConnectionFormProps {
  title: string
  defaultConnection?: ConnectionType
  defaultIP?: string
  onConnectionChange: (type: ConnectionType, ip: string) => void
}

export default function ConnectionForm({ title, defaultConnection = 'USB', defaultIP = '', onConnectionChange }: ConnectionFormProps) {
  const [type, setType] = useState<ConnectionType>(defaultConnection)
  const [ip, setIp] = useState(defaultIP)

  const update = (newType: ConnectionType, newIp: string) => {
    setType(newType)
    setIp(newIp)
    onConnectionChange(newType, newIp)
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm">{title}</h4>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="con-type" checked={type === 'USB'} onChange={() => update('USB', '')} className="text-brand-600" />
          USB
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="con-type" checked={type === 'LAN'} onChange={() => update('LAN', ip)} className="text-brand-600" />
          LAN
        </label>
        {type === 'LAN' && (
          <input
            type="text"
            value={ip}
            onChange={e => update('LAN', e.target.value)}
            placeholder="192.168.1.100"
            className="border rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ProgressLog.tsx**

`src/renderer/src/components/ProgressLog.tsx`:
```typescript
import type { InstallProgress } from '../../main/printer-engine/types'

interface ProgressLogProps {
  progress: InstallProgress[]
  isInstalling: boolean
}

export default function ProgressLog({ progress, isInstalling }: ProgressLogProps) {
  return (
    <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
      {progress.length === 0 && !isInstalling && (
        <p className="text-gray-500">พร้อมติดตั้ง...</p>
      )}
      {progress.map((p, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-gray-500 shrink-0">[{p.component.toUpperCase()}]</span>
          <span className={p.percent === 100 ? 'text-green-400' : 'text-green-300'}>
            {p.message}
          </span>
        </div>
      ))}
      {isInstalling && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-green-300">กำลังดำเนินการ...</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create InstallWizard.tsx**

`src/renderer/src/pages/InstallWizard.tsx`:
```typescript
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import StepIndicator from '../components/StepIndicator'
import ConnectionForm from '../components/ConnectionForm'
import ProgressLog from '../components/ProgressLog'
import { printerApi, useInstallProgress } from '../hooks/use-printer'
import type { ComponentType, ConnectionType, InstallProgress as InstallProgressType, InstallResult } from '../../main/printer-engine/types'
import StatusCard from '../components/StatusCard'

const STEPS = ['คำแนะนำ', 'เลือก Components', 'ตั้งค่า', 'ติดตั้ง', 'เสร็จสิ้น']

const GUIDE_ITEMS = [
  'เปิดเครื่องพิมพ์ทั้งสองเครื่อง แล้วเสียบสาย USB เข้าคอมพิวเตอร์โดยตรง ห้ามผ่าน Hub',
  'ปิดโปรแกรมอื่น ๆ ทั้งหมดก่อนติดตั้ง เช่น Word, Excel, Browser',
  'คลิกขวาตัวติดตั้ง แล้วเลือก "Run as administrator"',
  'LAN: ตรวจสอบ IP ให้ถูกต้อง และเครื่องพิมพ์กับคอมอยู่ Network เดียวกัน',
  'SmartCard: ต่อเน็ตเพื่อดาวน์โหลด Java (ถ้ายังไม่มี)',
  'ถ้าติดตั้งไม่สำเร็จ ให้ลองใช้โหมด "ตรวจสอบ" บน Dashboard แล้วกด Fix',
]

export default function InstallWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<ComponentType[]>([])
  const [config, setConfig] = useState<Record<string, { connectionType: ConnectionType; ip: string }>>({
    label: { connectionType: 'USB', ip: '' },
    bill: { connectionType: 'USB', ip: '192.168.1.101' },
  })
  const [subdomain, setSubdomain] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState<InstallProgressType[]>([])
  const [installResults, setInstallResults] = useState<InstallResult[]>([])
  const liveProgress = useInstallProgress()

  const toggleComponent = (comp: ComponentType) => {
    setSelected(prev =>
      prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]
    )
  }

  const components: { type: ComponentType; label: string; desc: string }[] = [
    { type: 'label', label: 'VET Label', desc: 'เครื่องพิมพ์ฉลากยา (Xprinter TSC)' },
    { type: 'bill', label: 'VET Bill', desc: 'เครื่องพิมพ์ใบเสร็จ (XP-80)' },
    { type: 'smartcard', label: 'SmartCard', desc: 'เครื่องอ่านบัตรประชาชน' },
    { type: 'vetmanage', label: 'VET MANAGE', desc: 'Shortcut เข้าระบบ' },
  ]

  const handleInstall = useCallback(async () => {
    setInstalling(true)
    setInstallProgress([])
    setInstallResults([])
    const results: InstallResult[] = []

    if (selected.includes('label')) {
      const cfg = config.label
      setInstallProgress(p => [...p, { component: 'label', phase: 'start', percent: 0, message: 'กำลังติดตั้ง VET Label...' }])
      const r = await printerApi.installPrinter('label', cfg.connectionType, cfg.ip || undefined)
      results.push(r)
    }

    if (selected.includes('bill')) {
      const cfg = config.bill
      setInstallProgress(p => [...p, { component: 'bill', phase: 'start', percent: 0, message: 'กำลังติดตั้ง VET Bill...' }])
      const r = await printerApi.installPrinter('bill', cfg.connectionType, cfg.ip || undefined)
      results.push(r)
    }

    if (selected.includes('smartcard')) {
      setInstallProgress(p => [...p, { component: 'smartcard', phase: 'java', percent: 0, message: 'กำลังตรวจสอบ Java...' }])
      const r = await printerApi.installSmartCard()
      results.push(r)
    }

    if (selected.includes('vetmanage') && subdomain) {
      setInstallProgress(p => [...p, { component: 'vetmanage', phase: 'shortcut', percent: 0, message: 'กำลังสร้าง Shortcut...' }])
      const r = await printerApi.installShortcut(subdomain)
      results.push(r)
    }

    setInstallResults(results)
    setInstalling(false)
    setStep(4)
  }, [selected, config, subdomain])

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">ติดตั้ง Printer Driver</h1>
      <StepIndicator steps={STEPS} currentStep={step} />

      {/* Step 0: Guide */}
      {step === 0 && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="font-semibold">คำแนะนำก่อนติดตั้ง</h2>
            <ul className="space-y-2">
              {GUIDE_ITEMS.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-brand-600 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Component Selection */}
      {step === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold">เลือกรายการที่ต้องการติดตั้ง</h2>
          {components.map(({ type, label, desc }) => (
            <label key={type} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              selected.includes(type) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={selected.includes(type)}
                onChange={() => toggleComponent(type)}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Step 2: Connection Settings */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <h2 className="font-semibold">ตั้งค่าการเชื่อมต่อ</h2>
            {selected.includes('label') && (
              <ConnectionForm
                title="VET Label — เครื่องพิมพ์ฉลากยา"
                onConnectionChange={(type, ip) => setConfig(c => ({ ...c, label: { connectionType: type, ip } }))}
              />
            )}
            {selected.includes('bill') && (
              <ConnectionForm
                title="VET Bill — เครื่องพิมพ์ใบเสร็จ"
                defaultIP="192.168.1.101"
                onConnectionChange={(type, ip) => setConfig(c => ({ ...c, bill: { connectionType: type, ip } }))}
              />
            )}
            {selected.includes('vetmanage') && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">VET MANAGE — Shortcut เข้าระบบ</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">https://</span>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={e => setSubdomain(e.target.value)}
                    placeholder="subdomain"
                    className="border rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-500">.vetmanage.co/login.php</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Installing */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold">กำลังติดตั้ง...</h2>
          <ProgressLog progress={installProgress} isInstalling={installing} />
        </div>
      )}

      {/* Step 4: Results */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold">ผลการติดตั้ง</h2>
          {installResults.map((r, i) => (
            <StatusCard
              key={i}
              title={`${r.component.toUpperCase()}`}
              status={r.success ? 'ok' : 'error'}
              details={r.error ? [r.error] : ['ติดตั้งสำเร็จ']}
            />
          ))}
          <Button onClick={() => navigate('/')} className="mt-4">
            <Check size={16} className="mr-2" />
            กลับไปหน้า Dashboard
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="ghost"
          onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}
          disabled={installing}
        >
          <ArrowLeft size={16} className="mr-2" />
          ย้อนกลับ
        </Button>
        {step < 3 && (
          <Button
            onClick={() => {
              if (step === 1 && selected.length === 0) return
              if (step === 2) {
                setStep(3)
                handleInstall()
              } else {
                setStep(s => s + 1)
              }
            }}
            disabled={step === 1 && selected.length === 0}
          >
            {step === 2 ? 'เริ่มติดตั้ง' : 'ถัดไป'}
            <ArrowRight size={16} className="ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd D:\windowproject\printerdriver
npx electron-vite build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/pages/InstallWizard.tsx src/renderer/src/components/StepIndicator.tsx src/renderer/src/components/ConnectionForm.tsx src/renderer/src/components/ProgressLog.tsx
git commit -m "feat: add Install Wizard with multi-step flow"
```

---

### Task 12: UI — Diagnostics & Settings Pages

**Files:**
- Create: `src/renderer/src/pages/Diagnostics.tsx`
- Create: `src/renderer/src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `StatusCard`, `useDiagnostics`, `printerApi` from Tasks 8-9
- Produces: Diagnostics page with Fix button, Settings page with Uninstall

- [ ] **Step 1: Create Diagnostics.tsx**

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Wrench, Shield, Printer, Smartphone } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import StatusCard from '../components/StatusCard'
import { useDiagnostics } from '../hooks/use-printer'
import type { InstallResult } from '../../main/printer-engine/types'
import type { Status } from '../components/StatusCard'

export default function Diagnostics() {
  const navigate = useNavigate()
  const { report, loading, error, run, fix } = useDiagnostics()
  const [fixing, setFixing] = useState(false)
  const [fixResults, setFixResults] = useState<InstallResult[] | null>(null)

  useEffect(() => { run() }, [run])

  const handleFix = async () => {
    setFixing(true)
    setFixResults(null)
    const results = await fix()
    setFixResults(results)
    setFixing(false)
  }

  const statusMap: Record<string, Status> = {
    healthy: 'ok',
    has_issues: 'warning',
    critical: 'error'
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ตรวจสอบระบบ</h1>
          <p className="text-sm text-gray-500">วินิจฉัยสถานะ Printer และอุปกรณ์</p>
        </div>
        <Button variant="outline" onClick={() => run()} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          ตรวจสอบใหม่
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            เกิดข้อผิดพลาด: {error}
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Overall */}
          <Card className={`border-2 ${report.overall === 'healthy' ? 'border-green-200 bg-green-50' : report.overall === 'has_issues' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield size={24} className={report.overall === 'healthy' ? 'text-green-600' : report.overall === 'has_issues' ? 'text-amber-600' : 'text-red-600'} />
                  <div>
                    <p className="font-bold">
                      {report.overall === 'healthy' ? '✅ ระบบปกติ' : report.overall === 'has_issues' ? '⚠️ มีปัญหาบางอย่าง' : '❌ จำเป็นต้องซ่อม'}
                    </p>
                    <p className="text-xs text-gray-500">USB Devices: {report.usb.devices.length}</p>
                  </div>
                </div>
                {report.overall !== 'healthy' && (
                  <Button onClick={handleFix} disabled={fixing}>
                    <Wrench size={16} className="mr-2" />
                    {fixing ? 'กำลังซ่อม...' : 'Fix All'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* USB */}
          <StatusCard
            title="USB Devices"
            subtitle="อุปกรณ์ที่เชื่อมต่อ USB"
            status={report.usb.status as Status}
            details={report.usb.devices.map(d => `${d.model} (${d.portName || 'no port'})`)}
          />

          {/* Printers */}
          <StatusCard
            title="VET Label"
            subtitle="เครื่องพิมพ์ฉลากยา"
            status={report.label.installed ? (report.label.printerOnline ? 'ok' : 'warning') : 'error'}
            details={report.label.details}
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate('/install')}>
                {report.label.installed ? 'ซ่อม' : 'ติดตั้ง'}
              </Button>
            }
          />

          <StatusCard
            title="VET Bill"
            subtitle="เครื่องพิมพ์ใบเสร็จ"
            status={report.bill.installed ? (report.bill.printerOnline ? 'ok' : 'warning') : 'error'}
            details={report.bill.details}
            actions={
              <Button size="sm" variant="outline" onClick={() => navigate('/install')}>
                {report.bill.installed ? 'ซ่อม' : 'ติดตั้ง'}
              </Button>
            }
          />

          <StatusCard
            title="SmartCard"
            subtitle="เครื่องอ่านบัตรประชาชน"
            status={report.smartcard.javaInstalled ? 'ok' : 'error'}
            details={report.smartcard.details}
          />

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">คำแนะนำ</CardTitle>
                <CardDescription>รายการที่ควรดำเนินการ</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-600 mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Fix Results */}
          {fixResults && fixResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">ผลการซ่อม</h3>
              {fixResults.map((r, i) => (
                <StatusCard
                  key={i}
                  title={r.component}
                  status={r.success ? 'ok' : 'error'}
                  details={r.error ? [r.error] : ['✅ ซ่อมสำเร็จ']}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create Settings.tsx**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Info, FileText } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import StatusCard from '../components/StatusCard'
import { printerApi } from '../lib/ipc'
import type { ComponentType, InstallResult } from '../../main/printer-engine/types'

const components: { type: ComponentType; label: string }[] = [
  { type: 'label', label: 'VET Label (เครื่องพิมพ์ฉลาก)' },
  { type: 'bill', label: 'VET Bill (เครื่องพิมพ์ใบเสร็จ)' },
  { type: 'smartcard', label: 'SmartCard (เครื่องอ่านบัตร)' },
  { type: 'vetmanage', label: 'VET MANAGE Shortcut' },
]

export default function Settings() {
  const navigate = useNavigate()
  const [uninstalling, setUninstalling] = useState<string | null>(null)
  const [result, setResult] = useState<InstallResult | null>(null)

  const handleUninstall = async (type: ComponentType, label: string) => {
    if (!confirm(`แน่ใจหรือว่าต้องการถอน ${label}?`)) return
    setUninstalling(type)
    setResult(null)
    const r = await printerApi.uninstallComponent(type)
    setResult(r)
    setUninstalling(null)
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>

      {/* Uninstall */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 size={18} className="text-red-500" />
            ถอนการติดตั้ง
          </CardTitle>
          <CardDescription>เลือกรายการที่ต้องการถอน</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {components.map(({ type, label }) => (
            <div key={type} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
              <span className="text-sm font-medium">{label}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleUninstall(type, label)}
                disabled={uninstalling === type}
              >
                {uninstalling === type ? 'กำลังถอน...' : 'ถอน'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {result && (
        <StatusCard
          title={result.component}
          status={result.success ? 'ok' : 'error'}
          details={result.error ? [result.error] : ['ถอนการติดตั้งสำเร็จ']}
        />
      )}

      <Separator />

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info size={18} className="text-brand-600" />
            เกี่ยวกับ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><strong>VET MANAGE Printer Driver</strong> v1.0.0</p>
          <p>ติดตั้งและจัดการเครื่องพิมพ์ VET Label, VET Bill, SmartCard Reader</p>
          <p className="text-xs text-gray-400">Built with Electron + React</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd D:\windowproject\printerdriver
npx electron-vite build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/pages/Diagnostics.tsx src/renderer/src/pages/Settings.tsx
git commit -m "feat: add Diagnostics and Settings pages"
```

---

### Task 13: Build & Packaging

**Files:**
- Modify: `electron-builder.yml` (verify config)
- No new code files

**Interfaces:**
- Produces: Packaged `.exe` installer in `release/` directory

- [ ] **Step 1: Verify electron-builder.yml**

Confirm `electron-builder.yml` has `extraResources` section for drivers and `requestedExecutionLevel`.

- [ ] **Step 2: Build production bundle**

```bash
cd D:\windowproject\printerdriver
npx electron-vite build
```
Expected: Build succeeds.

- [ ] **Step 3: Package the installer**

```bash
cd D:\windowproject\printerdriver
npx electron-builder --win --x64
```
Expected: `.exe` created in `release/` directory.

- [ ] **Step 4: Commit final build config**

```bash
git add electron-builder.yml
git commit -m "chore: configure electron-builder for production packaging"
```
