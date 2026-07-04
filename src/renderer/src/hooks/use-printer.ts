import { useState, useEffect, useCallback } from 'react'
import { printerApi } from '../lib/ipc'
import type { DiagnosticReport, InstallProgress } from '../../../main/printer-engine/types'

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
      await run()
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
