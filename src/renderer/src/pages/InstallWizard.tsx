import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import StepIndicator from '../components/StepIndicator'
import ConnectionForm from '../components/ConnectionForm'
import ProgressLog from '../components/ProgressLog'
import { useInstallProgress } from '../hooks/use-printer'
import { printerApi } from '../lib/ipc'
import type { ComponentType, ConnectionType, InstallProgress as InstallProgressType, InstallResult } from '../../../main/printer-engine/types'
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
