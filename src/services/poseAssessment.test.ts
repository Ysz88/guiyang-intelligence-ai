import { describe, expect, it } from 'vitest'
import {
  scorePoseFramesForTest,
  type PoseFrame,
} from './poseAssessment'

function frame(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    visibility: 0.96,
    frameQuality: 0.96,
    inFrameRatio: 1,
    centerOffset: 0.02,
    bodyScale: 0.25,
    shoulderX: 0.5,
    hipX: 0.5,
    hipY: 0.62,
    leftKneeY: 0.78,
    rightKneeY: 0.78,
    shoulderWidth: 0.24,
    torsoTilt: 0.04,
    wristX: 0.5,
    wristY: 0.52,
    leftWristAbove: false,
    rightWristAbove: false,
    fingerGap: 0.12,
    ankleMotionPoint: 0.5,
    leftAnkleX: 0.44,
    rightAnkleX: 0.56,
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

  it('recognizes alternating seated knee lifts without walking', () => {
    const frames = Array.from({ length: 30 }, (_, index) => frame({
      leftKneeY: index % 8 < 4 ? 0.62 : 0.8,
      rightKneeY: index % 8 >= 4 ? 0.62 : 0.8,
    }))

    const result = scorePoseFramesForTest(2, frames)

    expect(result.score).toBe(0)
    expect(result.summary).toContain('坐姿')
  })

  it('refuses to auto-select when pose quality is too low', () => {
    const frames = Array.from({ length: 5 }, () => frame({ visibility: 0.4 }))

    const result = scorePoseFramesForTest(2, frames, 24)

    expect(result.score).toBeNull()
    expect(result.summary).toContain('人工观察')
  })

  it('ignores a single landmark outlier in a stable sitting sequence', () => {
    const frames = Array.from({ length: 30 }, (_, index) => frame({
      torsoTilt: index === 15 ? 1.4 : 0.05,
      shoulderX: index === 15 ? 0.82 : 0.5,
    }))

    const result = scorePoseFramesForTest(0, frames)

    expect(result.score).toBe(0)
  })

  it('does not treat a brief arm landmark jump as completed bilateral raising', () => {
    const frames = Array.from({ length: 30 }, (_, index) => frame({
      leftWristAbove: index >= 12 && index <= 14,
      rightWristAbove: index >= 12 && index <= 14,
      wristY: index >= 12 && index <= 14 ? 0.3 : 0.54,
    }))

    const result = scorePoseFramesForTest(3, frames)

    expect(result.score).not.toBe(0)
  })

  it('refuses automatic scoring when required landmarks leave the frame', () => {
    const frames = Array.from({ length: 24 }, () => frame({
      inFrameRatio: 0.75,
      frameQuality: 0.82,
    }))

    const result = scorePoseFramesForTest(2, frames)

    expect(result.score).toBeNull()
    expect(result.summary).toContain('离开画面')
  })
})
