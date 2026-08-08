import { useCallback, useEffect, useState } from 'react'
import { generateDemoState } from '../data/generateDemoData'
import type { AssessmentRecord, DemoState } from '../types'

const STORAGE_KEY = 'guiyang-intelligence-ai-demo-v1'

function loadInitialState(): DemoState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as DemoState
  } catch {
    // Local storage may be unavailable in a restricted browser context.
  }
  return generateDemoState()
}

export function useDemoState() {
  const [state, setState] = useState<DemoState>(loadInitialState)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // The in-memory state remains fully usable.
    }
  }, [state])

  const saveRecord = useCallback((record: AssessmentRecord) => {
    setState((current) => {
      const existing = current.records.some((item) => item.id === record.id)
      const records = existing
        ? current.records.map((item) => (item.id === record.id ? record : item))
        : [record, ...current.records]
      const residents = current.residents.map((resident) =>
        resident.id === record.residentId
          ? {
              ...resident,
              checkStatus: record.status,
              lastCheckDate: record.checkDate,
              lastGrade: record.evaluation.overallGrade,
            }
          : resident,
      )
      return { ...current, records, residents }
    })
  }, [])

  const confirmReview = useCallback((recordId: string, adjustmentReason = '') => {
    setState((current) => {
      const target = current.records.find((record) => record.id === recordId)
      if (!target) return current
      const records = current.records.map((record) =>
        record.id === recordId
          ? {
              ...record,
              status: '已确认' as const,
              confirmedAt: new Date().toISOString(),
              confirmedBy: 'INS-DEMO-01',
              adjustmentReason,
            }
          : record,
      )
      const residents = current.residents.map((resident) =>
        resident.id === target.residentId
          ? { ...resident, checkStatus: '已确认' as const }
          : resident,
      )
      return { ...current, records, residents }
    })
  }, [])

  const reset = useCallback(() => {
    const fresh = generateDemoState()
    setState(fresh)
  }, [])

  return { state, saveRecord, confirmReview, reset }
}
