import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type { Grade, TaskScore } from '../types'

const ANALYSIS_INTERVAL_MS = 90
const MIN_USABLE_QUALITY = 0.5

const LANDMARK = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [15, 19], [15, 21], [16, 20], [16, 22],
]

export interface PoseObservationResult {
  score: TaskScore
  confidence: number
  quality: number
  summary: string
  metrics: string[]
  capturedFrames: number
}

export interface PoseFrame {
  visibility: number
  bodyScale: number
  shoulderX: number
  hipX: number
  hipY: number
  shoulderWidth: number
  torsoTilt: number
  wristX: number
  wristY: number
  leftWristAbove: boolean
  rightWristAbove: boolean
  fingerGap: number
  ankleMotionPoint: number
}

interface ObserveOptions {
  durationMs?: number
  signal?: AbortSignal
  onFrame?: (landmarks: NormalizedLandmark[], progress: number) => void
}

let landmarkerPromise: Promise<PoseLandmarker> | null = null

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value))

const midpoint = (first: NormalizedLandmark, second: NormalizedLandmark) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const distance = (
  first: Pick<NormalizedLandmark, 'x' | 'y'>,
  second: Pick<NormalizedLandmark, 'x' | 'y'>,
) => Math.hypot(first.x - second.x, first.y - second.y)

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0

const range = (values: number[]) =>
  values.length > 0 ? Math.max(...values) - Math.min(...values) : 0

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0
  const mean = average(values)
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
}

const percent = (value: number) => `${Math.round(clamp(value) * 100)}%`
const metric = (value: number) => value.toFixed(2)

function resolveAsset(relativePath: string) {
  return new URL(relativePath, document.baseURI).toString()
}

async function createLandmarker(delegate: 'CPU' | 'GPU') {
  const fileset = await FilesetResolver.forVisionTasks(
    resolveAsset('mediapipe-wasm/'),
  )
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: resolveAsset('models/pose_landmarker_lite.task'),
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputSegmentationMasks: false,
  })
}

export function loadPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker('GPU').catch(() => createLandmarker('CPU'))
  }
  return landmarkerPromise
}

function frameFromLandmarks(landmarks: NormalizedLandmark[]): PoseFrame | null {
  if (landmarks.length < 29) return null

  const leftShoulder = landmarks[LANDMARK.leftShoulder]
  const rightShoulder = landmarks[LANDMARK.rightShoulder]
  const leftWrist = landmarks[LANDMARK.leftWrist]
  const rightWrist = landmarks[LANDMARK.rightWrist]
  const leftIndex = landmarks[LANDMARK.leftIndex]
  const rightIndex = landmarks[LANDMARK.rightIndex]
  const leftThumb = landmarks[LANDMARK.leftThumb]
  const rightThumb = landmarks[LANDMARK.rightThumb]
  const leftHip = landmarks[LANDMARK.leftHip]
  const rightHip = landmarks[LANDMARK.rightHip]
  const leftAnkle = landmarks[LANDMARK.leftAnkle]
  const rightAnkle = landmarks[LANDMARK.rightAnkle]

  const required = [
    leftShoulder, rightShoulder, leftWrist, rightWrist,
    leftHip, rightHip, leftAnkle, rightAnkle,
  ]
  if (required.some((point) => !point)) return null

  const shoulder = midpoint(leftShoulder, rightShoulder)
  const hip = midpoint(leftHip, rightHip)
  const wrist = midpoint(leftWrist, rightWrist)
  const bodyScale = Math.max(0.08, distance(shoulder, hip))
  const visibility = average(required.map((point) => clamp(point.visibility)))

  return {
    visibility,
    bodyScale,
    shoulderX: shoulder.x,
    hipX: hip.x,
    hipY: hip.y,
    shoulderWidth: distance(leftShoulder, rightShoulder),
    torsoTilt: Math.abs(shoulder.x - hip.x) / bodyScale,
    wristX: wrist.x,
    wristY: wrist.y,
    leftWristAbove: leftWrist.y < leftShoulder.y - 0.015,
    rightWristAbove: rightWrist.y < rightShoulder.y - 0.015,
    fingerGap: average([
      distance(leftThumb, leftIndex),
      distance(rightThumb, rightIndex),
    ]) / bodyScale,
    ankleMotionPoint: (leftAnkle.x + rightAnkle.x) / 2,
  }
}

function buildResult(
  taskIndex: number,
  frames: PoseFrame[],
  attemptedFrames: number,
): PoseObservationResult {
  const detectionRate = attemptedFrames > 0 ? frames.length / attemptedFrames : 0
  const visibility = average(frames.map((frame) => frame.visibility))
  const quality = clamp(detectionRate * visibility)
  const capturedFrames = frames.length

  if (frames.length < 8 || quality < MIN_USABLE_QUALITY) {
    return {
      score: null,
      confidence: quality,
      quality,
      summary: '未持续识别到完整姿态，请调整距离、光线或改用人工观察。',
      metrics: [`有效帧 ${capturedFrames}/${attemptedFrames}`, `姿态质量 ${percent(quality)}`],
      capturedFrames,
    }
  }

  const scale = average(frames.map((frame) => frame.bodyScale))
  const hipVerticalRange = range(frames.map((frame) => frame.hipY)) / scale
  const hipHorizontalRange = range(frames.map((frame) => frame.hipX)) / scale
  const shoulderSway = standardDeviation(
    frames.map((frame) => frame.shoulderX - frame.hipX),
  ) / scale
  const torsoTilt = average(frames.map((frame) => frame.torsoTilt))
  const shoulderWidths = frames.map((frame) => frame.shoulderWidth)
  const shoulderWidthChange = range(shoulderWidths) / Math.max(0.04, Math.max(...shoulderWidths))
  const ankleMotion = range(frames.map((frame) => frame.ankleMotionPoint)) / scale
  const wristMotion = Math.hypot(
    range(frames.map((frame) => frame.wristX)),
    range(frames.map((frame) => frame.wristY)),
  ) / scale
  const bothRaisedRatio = frames.filter(
    (frame) => frame.leftWristAbove && frame.rightWristAbove,
  ).length / frames.length
  const oneRaisedRatio = frames.filter(
    (frame) => frame.leftWristAbove || frame.rightWristAbove,
  ).length / frames.length
  const fingerGapChange = range(frames.map((frame) => frame.fingerGap))

  let score: Grade
  let evidenceStrength = 0.82
  let summary: string
  let metrics: string[]

  if (taskIndex === 0) {
    if (torsoTilt < 0.13 && shoulderSway < 0.1) score = 0
    else if (torsoTilt < 0.22 && shoulderSway < 0.18) score = 1
    else if (torsoTilt < 0.38) score = 2
    else score = 3
    summary = score === 0
      ? '躯干保持直立且画面内晃动较小。'
      : '检测到躯干偏移或持续晃动，建议现场确认支撑情况。'
    metrics = [`躯干偏移 ${metric(torsoTilt)}`, `肩部晃动 ${metric(shoulderSway)}`]
  } else if (taskIndex === 1) {
    const transferMotion = hipVerticalRange + ankleMotion * 0.25
    if (transferMotion > 0.62) score = 0
    else if (transferMotion > 0.38) score = 1
    else if (transferMotion > 0.17) score = 2
    else score = 3
    summary = score <= 1
      ? '检测到较完整的起身与转移动作。'
      : '髋部位移不足，可能未完成转移或画面范围不完整。'
    metrics = [`髋部垂直位移 ${metric(hipVerticalRange)}`, `下肢位移 ${metric(ankleMotion)}`]
  } else if (taskIndex === 2) {
    const walkingMotion = hipHorizontalRange + ankleMotion * 0.45
    if (walkingMotion > 1.0 && shoulderWidthChange > 0.16 && shoulderSway < 0.34) score = 0
    else if (walkingMotion > 0.68 && shoulderWidthChange > 0.1) score = 1
    else if (walkingMotion > 0.28) score = 2
    else score = 3
    summary = score === 0
      ? '检测到行走位移、转身变化且躯干总体稳定。'
      : '动作位移或转身证据不足；辅具与搀扶情况仍需现场确认。'
    metrics = [
      `行走位移 ${metric(walkingMotion)}`,
      `转身变化 ${metric(shoulderWidthChange)}`,
      `肩部晃动 ${metric(shoulderSway)}`,
    ]
  } else if (taskIndex === 3) {
    if (bothRaisedRatio > 0.08) score = 0
    else if (oneRaisedRatio > 0.08) score = 1
    else if (wristMotion > 0.24) score = 2
    else score = 3
    summary = score === 0
      ? '左右手腕均曾高于对应肩部。'
      : '仅单侧或未检测到手腕越过肩部。'
    metrics = [
      `双侧抬臂帧占比 ${percent(bothRaisedRatio)}`,
      `单侧抬臂帧占比 ${percent(oneRaisedRatio)}`,
    ]
  } else {
    evidenceStrength = 0.64
    if (fingerGapChange > 0.12 && wristMotion > 0.16) score = 0
    else if (fingerGapChange > 0.07) score = 1
    else if (fingerGapChange > 0.025 || wristMotion > 0.1) score = 2
    else score = 3
    summary = score <= 1
      ? '检测到拇指、食指间距变化和手腕移动。'
      : '手部关键点变化较小；小动作识别精度有限，必须人工确认。'
    metrics = [`指间变化 ${metric(fingerGapChange)}`, `手腕位移 ${metric(wristMotion)}`]
  }

  const confidence = clamp(quality * evidenceStrength, 0, 0.96)
  return {
    score,
    confidence,
    quality,
    summary,
    metrics: [...metrics, `姿态质量 ${percent(quality)}`],
    capturedFrames,
  }
}

export function scorePoseFramesForTest(
  taskIndex: number,
  frames: PoseFrame[],
  attemptedFrames = frames.length,
) {
  return buildResult(taskIndex, frames, attemptedFrames)
}

export async function observeMobilityTask(
  video: HTMLVideoElement,
  taskIndex: number,
  options: ObserveOptions = {},
): Promise<PoseObservationResult> {
  const durationMs = options.durationMs ?? 6000
  const landmarker = await loadPoseLandmarker()
  const frames: PoseFrame[] = []
  const startedAt = performance.now()
  let attemptedFrames = 0
  let lastAnalysisAt = 0

  while (performance.now() - startedAt < durationMs) {
    if (options.signal?.aborted) throw new DOMException('分析已取消', 'AbortError')
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const now = performance.now()
    if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS || video.readyState < 2) continue
    lastAnalysisAt = now
    attemptedFrames += 1
    const result = landmarker.detectForVideo(video, now)
    const landmarks = result.landmarks[0]
    if (landmarks) {
      const frame = frameFromLandmarks(landmarks)
      if (frame) frames.push(frame)
      options.onFrame?.(landmarks, clamp((now - startedAt) / durationMs))
    } else {
      options.onFrame?.([], clamp((now - startedAt) / durationMs))
    }
  }

  return buildResult(taskIndex, frames, attemptedFrames)
}
