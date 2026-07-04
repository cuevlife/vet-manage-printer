import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Wrench, Shield, Printer, Smartphone } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Separator } from '../components/ui/separator'
import StatusCard from '../components/StatusCard'
import { useDiagnostics } from '../hooks/use-printer'
import type { InstallResult } from '../../../main/printer-engine/types'
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
