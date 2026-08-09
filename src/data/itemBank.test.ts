import { describe, expect, it } from 'vitest'
import {
  createItemSelection,
  ITEM_BANK,
  ITEM_BANK_VERSION,
  selectedItemFor,
} from './itemBank'

describe('versioned equivalent item bank', () => {
  it('provides at least six unique variants for every randomized task', () => {
    for (const [taskId, variants] of Object.entries(ITEM_BANK)) {
      expect(variants.length).toBeGreaterThanOrEqual(6)
      expect(new Set(variants.map((variant) => variant.id)).size).toBe(variants.length)
      expect(variants.every((variant) => variant.taskId === taskId)).toBe(true)
      expect(variants.every((variant) => variant.prompt.trim().length > 0)).toBe(true)
    }
  })

  it('keeps every vision-card set at four distinct characters', () => {
    for (const variant of ITEM_BANK['ST-01']) {
      expect(variant.materials).toHaveLength(4)
      expect(new Set(variant.materials).size).toBe(4)
    }
  })

  it('selects a stable auditable set for the same resident and date', () => {
    const first = createItemSelection('SIM-RES-055', '2026-08-09')
    const second = createItemSelection('SIM-RES-055', '2026-08-09')

    expect(second).toEqual(first)
    expect(first.bankVersion).toBe(ITEM_BANK_VERSION)
    expect(Object.keys(first.items).sort()).toEqual(Object.keys(ITEM_BANK).sort())
    expect(selectedItemFor(first, 'ST-01')?.bankVersion).toBe(ITEM_BANK_VERSION)
  })

  it('changes the auditable selection seed across annual dates', () => {
    const first = createItemSelection('SIM-RES-055', '2026-08-09')
    const nextYear = createItemSelection('SIM-RES-055', '2027-08-09')

    expect(nextYear.selectionSeed).not.toBe(first.selectionSeed)
    expect(nextYear.items).not.toEqual(first.items)
  })
})
