import { useState } from 'react'
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
