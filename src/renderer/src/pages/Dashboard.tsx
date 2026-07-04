import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wrench, Usb, Search } from 'lucide-react'
import StatusCard from '../components/StatusCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { useDiagnostics } from '../hooks/use-printer'
import { printerApi } from '../lib/ipc'
import type { Status } from '../components/StatusCard'
import type { USBDevice } from '../../../main/printer-engine/types'

function statusFrom<T>(value: T, okValue: T): Status {
  return value === okValue ? 'ok' : value === undefined ? 'idle' : 'error'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { report, loading, error, run } = useDiagnostics()
  const [scanDone, setScanDone] = useState(false)

  const [labelPort, setLabelPort] = useState<USBDevice | null>(null)
  const [labelScanning, setLabelScanning] = useState(false)
  const [billPort, setBillPort] = useState<USBDevice | null>(null)
  const [billScanning, setBillScanning] = useState(false)

  useEffect(() => {
    run().finally(() => setScanDone(true))
  }, [run])

  const scanLabelPort = async () => {
    setLabelScanning(true)
    setLabelPort(null)
    try {
      const port = await printerApi.detectPortForType('label')
      setLabelPort(port)
    } finally {
      setLabelScanning(false)
    }
  }

  const scanBillPort = async () => {
    setBillScanning(true)
    setBillPort(null)
    try {
      const port = await printerApi.detectPortForType('bill')
      setBillPort(port)
    } finally {
      setBillScanning(false)
    }
  }

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

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>การตรวจสอบล้มเหลว: {error}</span>
          </CardContent>
        </Card>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusCard
          title="VET Label"
          subtitle="เครื่องพิมพ์ฉลากยา (Xprinter TSC)"
          status={report ? statusFrom(report.label.installed, true) : 'loading'}
          details={
            labelPort
              ? [`✅ พอร์ต: ${labelPort.portName || labelPort.model}`, ...(report?.label.details || [])]
              : report?.label.details
          }
          actions={
            <>
              <Button size="sm" variant="outline" onClick={scanLabelPort} disabled={labelScanning}>
                <Search size={14} className={labelScanning ? 'animate-spin mr-1' : 'mr-1'} />
                {labelScanning ? 'กำลังค้นหา...' : labelPort ? 'ค้นหาใหม่' : 'หา Port'}
              </Button>
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
          details={
            billPort
              ? [`✅ พอร์ต: ${billPort.portName || billPort.model}`, ...(report?.bill.details || [])]
              : report?.bill.details
          }
          actions={
            <>
              <Button size="sm" variant="outline" onClick={scanBillPort} disabled={billScanning}>
                <Search size={14} className={billScanning ? 'animate-spin mr-1' : 'mr-1'} />
                {billScanning ? 'กำลังค้นหา...' : billPort ? 'ค้นหาใหม่' : 'หา Port'}
              </Button>
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
