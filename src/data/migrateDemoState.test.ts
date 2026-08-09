import { describe, expect, it } from 'vitest'
import { generateDemoState } from './generateDemoData'
import { DEMO_STATE_VERSION, upgradeDemoState } from './migrateDemoState'

describe('demo-state migration', () => {
  it('adds deterministic item-selection audit to legacy records', () => {
    const legacy = generateDemoState()
    const first = legacy.records[0]
    legacy.version = 1
    first.draft.itemSelection = undefined

    const upgraded = upgradeDemoState(legacy)
    const migrated = upgraded.records[0]

    expect(upgraded.version).toBe(DEMO_STATE_VERSION)
    expect(migrated.draft.itemSelection?.selectedForDate).toBe(migrated.checkDate)
    expect(migrated.draft.itemSelection?.items['ST-01']).toBeDefined()
  })

  it('preserves an existing selection snapshot', () => {
    const current = generateDemoState()
    const existing = current.records[0].draft.itemSelection

    const upgraded = upgradeDemoState(current)

    expect(upgraded.records[0].draft.itemSelection).toEqual(existing)
  })
})
