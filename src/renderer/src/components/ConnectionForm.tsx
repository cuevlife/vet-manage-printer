import { useState, useId } from 'react'
import type { ConnectionType } from '../../../main/printer-engine/types'

interface ConnectionFormProps {
  title: string
  defaultConnection?: ConnectionType
  defaultIP?: string
  onConnectionChange: (type: ConnectionType, ip: string) => void
}

export default function ConnectionForm({ title, defaultConnection = 'USB', defaultIP = '', onConnectionChange }: ConnectionFormProps) {
  const [type, setType] = useState<ConnectionType>(defaultConnection)
  const [ip, setIp] = useState(defaultIP)
  const uid = useId()

  const update = (newType: ConnectionType, newIp: string) => {
    setType(newType)
    setIp(newIp)
    onConnectionChange(newType, newIp)
  }

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm">{title}</h4>
      <div className="space-y-2">
        <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input
            type="radio"
            name={`con-${uid}`}
            checked={type === 'USB'}
            onChange={() => update('USB', '')}
            className="w-4 h-4 text-brand-600"
          />
          <div>
            <p className="text-sm font-medium">USB</p>
            <p className="text-xs text-gray-500">เชื่อมต่อผ่านสาย USB โดยตรง</p>
          </div>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input
            type="radio"
            name={`con-${uid}`}
            checked={type === 'LAN'}
            onChange={() => update('LAN', ip || '192.168.1.100')}
            className="w-4 h-4 text-brand-600"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">LAN</p>
            <p className="text-xs text-gray-500">เชื่อมต่อผ่านเครือข่าย</p>
            {type === 'LAN' && (
              <div className="mt-2 flex items-center gap-1 text-sm">
                <span className="text-gray-500">IP:</span>
                <input
                  type="text"
                  value={ip}
                  onChange={e => update('LAN', e.target.value)}
                  placeholder="192.168.1.100"
                  className="border rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  )
}
