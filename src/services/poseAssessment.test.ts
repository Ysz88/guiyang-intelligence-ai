import { describe, expect, it } from 'vitest'
import {
  scorePoseFramesForTest,
  type PoseFrame,
} from './poseAssessment'

function frame(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    visibility: 0.96,
    bodyScale: 0.25,
    shoulderX: 0.5,
    hipX: 0.5,
    hipY: 0.62,
    shoulderWidth: 0.24,
    torsoTilt: 0.04,
    wristX: 0.5,
    wristY: 0.52,
    leftWristAbove: false,
    rightWristAbove: false,
    fingerGap: 0.12,
    ankleMotionPoint: 0.5,
    ...overrides,
  }
}

describe('pose observation scoring', () => {
  it('suggests independent sitting for a stable upright pose sequence', () => {
    const frames = Array.from({ length: 24 }, (_, index) => frame({
      shoulderX: 0.5 + Math.sin(index) * 0.002,
      hipX: 0.5,
    }))

    const result = scorePoseFramesForTest(0, frames)

    expect(result.score).toBe(0)
    expect(result.quality).toBeGreaterThan(0.9)
  })

  it('recognizes bilateral arm raising', () => {
    const frames = Array.from({ length: 24 }, (_, index) => frame({
      leftWristAbove: index > 4,
      rightWristAbove: index > 4,
      wristY: index > 4 ? 0.3 : 0.55,
    }))

    const result = scorePoseFramesForTest(3, frames)

    expect(result.score).toBe(0)
    expect(result.summary).toContain('左右手腕')
  })

  it('refuses to auto-select when pose quality is too low', () => {
    const frames = Array.from({ length: 5 }, () => frame({ visibility: 0.4 }))

    const result = scorePoseFramesForTest(2, frames, 24)

    expect(result.score).toBeNull()
    expect(result.summary).toContain('人工观察')
  })
})
