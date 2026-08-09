import { createItemSelection } from './itemBank'
import type { DemoState } from '../types'

export const DEMO_STATE_VERSION = 2

export function upgradeDemoState(state: DemoState): DemoState {
  const records = state.records.map((record) => {
    if (record.draft.itemSelection) return record
    return {
      ...record,
      draft: {
        ...record.draft,
        itemSelection: createItemSelection(record.residentId, record.checkDate),
      },
    }
  })

  return {
    ...state,
    records,
    version: DEMO_STATE_VERSION,
  }
}
