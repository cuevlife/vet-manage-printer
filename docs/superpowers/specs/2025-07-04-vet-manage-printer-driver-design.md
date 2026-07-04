# VET MANAGE Printer Driver — Electron App Design

## เป้าหมาย

สร้าง Electron desktop app สำหรับติดตั้ง จัดการ และวินิจฉัย Printer Driver ของ VET MANAGE แทนที่ Inno Setup Installer เดิม (`D:\Dev\ISS\installer.iss`) โดยเน้น:

- **สวยงาม** — UI ทันสมัย ใช้ธีม VET MANAGE branding
- **เช็คแก้ไขได้จริง** — มี Diagnostic Engine ตรวจสอบ USB port, driver, printer, connectivity และ Fix อัตโนมัติ

## Components

คง 4 Components เหมือนเดิม:

1. **VET Label** — เครื่องพิมพ์ฉลากยา (Xprinter TSC)
2. **VET Bill** — เครื่องพิมพ์ใบเสร็จ (XP-80)
3. **SmartCard** — Smart Card Reader (พึ่ง Java)
4. **VET MANAGE Shortcut** — Shortcut เข้าระบบ `.vetmanage.co`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 33+ |
| Frontend | React 18 + TypeScript |
| Build | electron-vite (Vite) |
| UI | Tailwind CSS + Shadcn/ui |
| Icons | Lucide React |
| Printer Engine | Node.js native (child_process calls to pnputil, printui.dll, WMI, Registry) |
| Admin Rights | electron-sudo หรือ custom elevation |
| Packaging | electron-builder |
| Language | TypeScript ทั้งโปรเจค |

## Architecture

```
Main Process (Electron)
├── IPC Handler — bridge ระหว่าง Renderer ↔ Printer Engine
├── Printer Engine (Node.js)
│   ├── detectUSBPorts()      — 8-method algorithm
│   ├── detectInstalledPrinters()
│   ├── checkDriverStatus()
│   ├── diagnose()            — สร้าง DiagnosticReport
│   ├── installPrinter()      — pnputil + printui.dll
│   ├── uninstallComponent()
│   ├── fixAll()              — ซ่อมตาม report
│   ├── testPrint()
│   └── getErrorLogs()
└── Windows Native Calls (child_process)
    ├── pnputil /add-driver
    ├── printui.dll,PrintUIEntry
    ├── WMI (Win32_Printer, Win32_PnPEntity)
    └── Registry (USB Monitor Ports, Java)

Renderer (React + Vite)
├── Dashboard Page (หน้าแรก)
├── Install Wizard (step-by-step)
├── Diagnostic Page
└── Settings Page
```

## UI Structure

### 1. Dashboard (หน้าแรก)
- แสดงสถานะ 4 components เป็น cards
- สถานะ: Connected / Not Installed / Error
- USB port ที่ detect ได้
- ปุ่ม: Install, Fix, Test Print, Run Diagnostics

### 2. Install Wizard
- Step 1: Guide — คำแนะนำก่อนติดตั้ง
- Step 2: Component Selection — เลือก Label/Bill/SmartCard/VET MANAGE
- Step 3: Connection Settings — USB/LAN + IP, Subdomain
- Step 4: Installing — real-time progress log
- Step 5: Results — success/fail ราย component, error details

### 3. Diagnostic Page
- Auto scan: USB ports, drivers, printer queues, Java
- Results: ✅/⚠️/❌ พร้อมคำแนะนำ
- "Fix All" — ซ่อมทีละตัวอัตโนมัติ
- Show error logs

### 4. Settings
- Uninstall components
- View logs
- About

## Diagnostic Engine

```typescript
interface DiagnosticReport {
  usb: { status: 'ok'|'warning'|'error', devices: USBDevice[], message: string }
  label: PrinterDiagnostic
  bill: PrinterDiagnostic
  smartcard: SmartCardDiagnostic
  overall: 'healthy'|'has_issues'|'critical'
  recommendations: string[]
}

interface PrinterDiagnostic {
  installed: boolean
  connected: boolean
  driverOk: boolean
  portConfigured: boolean
  printerOnline: boolean
}
```

### Detection Methods (ported from PS1 8-method algorithm)
1. Registry USB Monitor Ports (active check)
2. VID/PID from active USB devices
3. USBPRINT model name matching
4. UNKNOWNPRINTER detection
5. Get-PrinterPort description fallback
6-7. Single/Last USB port fallback
8. Hard fail (never guess)

## Windows Native Calls

| Operation | Windows Tool | Notes |
|-----------|-------------|-------|
| Add driver | `pnputil /add-driver` | Silent install |
| Install printer | `printui.dll,PrintUIEntry /il` | ผ่าน INF |
| Remove printer | `printui.dll,PrintUIEntry /dl` | |
| USB detection | WMI + Registry | `Win32_PnPEntity`, `USB Monitor\Ports` |
| Printer status | WMI `Win32_Printer` | |
| Java check | Registry + `java -version` | |

## Packaging

- **Builder:** electron-builder
- **Output:** `.exe` installer (NSIS or portable)
- **Admin:** `requestedExecutionLevel: requireAdministrator`
- **Driver files:** bundled in `resources/drivers/`
- **Install path:** `%PROGRAMFILES%\VET MANAGE\Printer Driver\`
- **Uninstall:** Windows Add/Remove Programs + in-app uninstall
- **Est. size:** ~50-80 MB (Electron + Chromium + drivers)

## Project Structure (draft)

```
D:\windowproject\printerdriver\
├── package.json
├── electron-builder.yml
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # App entry, window creation
│   │   ├── ipc-handlers.ts   # IPC bridge
│   │   └── printer-engine/   # Printer management
│   │       ├── index.ts
│   │       ├── usb-detection.ts
│   │       ├── driver-install.ts
│   │       ├── diagnostics.ts
│   │       └── types.ts
│   ├── renderer/             # React frontend
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── InstallWizard.tsx
│   │   │   ├── Diagnostics.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   └── styles/
│   └── preload/
│       └── index.ts
├── resources/
│   ├── drivers/              # Driver files (copied from D:\Dev\ISS)
│   │   ├── label/
│   │   ├── bill/
│   │   └── SmartCard/
│   └── icon.ico
└── docs/
    └── superpowers/
        └── specs/
            └── 2025-07-04-vet-manage-printer-driver-design.md
```

## Success Criteria

1. ติดตั้ง Label Printer + Bill Printer + SmartCard + Shortcut สำเร็จ
2. USB Port Detection ทำงานถูกต้อง (8-method algorithm)
3. Diagnostic ตรวจพบปัญหาที่พบบ่อย
4. Fix mode สามารถซ่อมปัญหาได้อัตโนมัติ
5. Uninstall ลบทุกอย่างสะอาด
6. UI ดู professional ใช้ธีม VET MANAGE
