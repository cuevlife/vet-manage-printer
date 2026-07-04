import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Info, Coffee } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import StatusCard from '../components/StatusCard'
import { printerApi } from '../lib/ipc'
import type { ComponentType, InstallResult } from '../../../main/printer-engine/types'

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

      {/* Uninstall Java */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coffee size={18} className="text-amber-600" />
            Java Runtime (สำหรับ SmartCard)
          </CardTitle>
          <CardDescription>Java ที่ใช้กับเครื่องอ่านบัตรประชาชน</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (!confirm('แน่ใจหรือว่าต้องการถอน Java? SmartCard จะไม่ทำงาน')) return
              setUninstalling('java')
              setResult(null)
              const ok = await printerApi.uninstallJava()
              setResult({ component: 'Java' as ComponentType, success: ok, error: ok ? undefined : 'ไม่พบ Java ในระบบ' })
              setUninstalling(null)
            }}
            disabled={uninstalling === 'java'}
          >
            {uninstalling === 'java' ? 'กำลังถอน...' : 'ถอน Java'}
          </Button>
        </CardContent>
      </Card>

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
