import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'
import type { Grade, TaskScore } from '../types'

const ANALYSIS_INTERVAL_MS = 90
const WARMUP_MS = 900
const MIN_USABLE_QUALITY = 0.58
const MIN_DETECTION_RATE = 0.55
const MIN_USABLE_FRAMES = 12

const LANDMARK = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

const TASK_LANDMARKS: number[][] = [
  [11, 12, 23, 24],
  [11, 12, 23, 24, 25, 26, 27, 28],
  [11, 12, 23, 24, 25, 26, 27, 28],
  [11, 12, 13, 14, 15, 16],
  [11, 12, 15, 16, 19, 20, 21, 22],
]

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
  frameQuality: number
  inFrameRatio: number
  centerOffset: number
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
  leftAnkleX: number
  rightAnkleX: number
}

export interface PoseFrameGuidance {
  level: 'ready' | 'adjust' | 'missing'
  message: string
  quality: number
}

interface ObserveOptions {
  durationMs?: number
  signal?: AbortSignal
  onFrame?: (
    landmarks: NormalizedLandmark[],
    progress: number,
    guidance: PoseFrameGuidance,
  ) => void
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

const quantile = (values: number[], percentile: number) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const position = clamp(percentile) * (sorted.length - 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

const median = (values: number[]) => quantile(values, 0.5)

const robustRange = (values: number[]) =>
  values.length < 5 ? range(values) : quantile(values, 0.9) - quantile(values, 0.1)

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0
  const mean = average(values)
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)))
}

const robustDeviation = (values: number[]) => {
  if (values.length < 5) return standardDeviation(values)
  const middle = median(values)
  return median(values.map((value) => Math.abs(value - middle))) * 1.4826
}

const longestTrueRun = (values: boolean[]) => {
  let longest = 0
  let current = 0
  for (const value of values) {
    current = value ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

const percent = (value: number) => `${Math.round(clamp(value) * 100)}%`
const metric = (value: number) => value.toFixed(2)

function resolveAsset(relativePath: string) {
  return new URL(relativePath, document.baseURI).toString()
}

async function createLandmarker(
  delegate: 'CPU' | 'GPU',
  modelName: 'pose_landmarker_full.task' | 'pose_landmarker_lite.task',
) {
  const fileset = await FilesetResolver.forVisionTasks(
    resolveAsset('mediapipe-wasm/'),
  )
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: resolveAsset(`models/${modelName}`),
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

async function createBestAvailableLandmarker(delegate: 'CPU' | 'GPU') {
  try {
    return await createLandmarker(delegate, 'pose_landmarker_full.task')
  } catch {
    return createLandmarker(delegate, 'pose_landmarker_lite.task')
  }
}

export function loadPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createBestAvailableLandmarker('GPU')
      .catch(() => createBestAvailableLandmarker('CPU'))
      .catch((error) => {
        landmarkerPromise = null
        throw error
      })
  }
  return landmarkerPromise
}

function frameFromLandmarks(
  landmarks: NormalizedLandmark[],
  taskIndex: number,
): PoseFrame | null {
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

  const required = (TASK_LANDMARKS[taskIndex] ?? TASK_LANDMARKS[0])
    .map((index) => landmarks[index])
  if (required.some((point) =>
    !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
  )) return null

  const shoulder = midpoint(leftShoulder, rightShoulder)
  const hip = midpoint(leftHip, rightHip)
  const wrist = midpoint(leftWrist, rightWrist)
  const shoulderWidth = distance(leftShoulder, rightShoulder)
  const bodyScale = Math.max(
    0.08,
    taskIndex >= 3 ? shoulderWidth : distance(shoulder, hip),
  )
  const visibility = average(required.map((point) => clamp(point.visibility)))
  const inFrameRatio = required.filter((point) =>
    point.x >= 0.025 && point.x <= 0.975 && point.y >= 0.025 && point.y <= 0.975
  ).length / required.length
  const centerOffset = Math.abs(
    (taskIndex >= 3 ? shoulder.x : (shoulder.x + hip.x) / 2) - 0.5,
  )
  const visibilityScore = clamp((visibility - 0.42) / 0.48)
  const centerScore = clamp(1 - centerOffset / 0.42)
  const sizeScore = Math.min(
    clamp((bodyScale - 0.075) / 0.075),
    clamp((0.58 - bodyScale) / 0.14),
  )
  const frameQuality = clamp(
    visibilityScore * 0.6 + inFrameRatio * 0.22 + centerScore * 0.1 + sizeScore * 0.08,
  )

  return {
    visibility,
    frameQuality,
    inFrameRatio,
    centerOffset,
    bodyScale,
    shoulderX: shoulder.x,
    hipX: hip.x,
    hipY: hip.y,
    shoulderWidth,
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
    leftAnkleX: leftAnkle.x,
    rightAnkleX: rightAnkle.x,
  }
}

function guidanceForFrame(
  frame: PoseFrame | null,
  taskIndex: number,
): PoseFrameGuidance {
  if (!frame) {
    return { level: 'missing', message: '未识别到人体，请正对摄像头', quality: 0 }
  }
  if (frame.visibility < 0.62) {
    return { level: 'adjust', message: '光线或遮挡影响关键点，请调整', quality: frame.frameQuality }
  }
  if (frame.inFrameRatio < 0.98) {
    return {
      level: 'adjust',
      message: taskIndex === 1 || taskIndex === 2
        ? '请后退，让肩部、髋部和脚踝完整入镜'
        : '请让肩部和双手完整入镜',
      quality: frame.frameQuality,
    }
  }
  if (frame.centerOffset > 0.24) {
    return { level: 'adjust', message: '请移动到画面中央', quality: frame.frameQuality }
  }
  if (frame.bodyScale < 0.11) {
    return { level: 'adjust', message: '距离较远，请靠近一些', quality: frame.frameQuality }
  }
  if (frame.bodyScale > 0.48) {
    return { level: 'adjust', message: '距离过近，请后退一些', quality: frame.frameQuality }
  }
  return { level: 'ready', message: '取景良好，请按提示完成动作', quality: frame.frameQuality }
}

function buildResult(
  taskIndex: number,
  candidateFrames: PoseFrame[],
  attemptedFrames: number,
): PoseObservationResult {
  const frames = candidateFrames.filter((frame) => frame.frameQuality >= 0.45)
  const detectionRate = attemptedFrames > 0 ? frames.length / attemptedFrames : 0
  const visibility = average(frames.map((frame) => frame.visibility))
  const framing = average(frames.map((frame) => frame.inFrameRatio))
  const frameQuality = average(frames.map((frame) => frame.frameQuality))
  const quality = clamp(detectionRate * frameQuality)
  const capturedFrames = frames.length

  if (
    frames.length < MIN_USABLE_FRAMES
    || detectionRate < MIN_DETECTION_RATE
    || visibility < 0.62
    || framing < 0.9
    || quality < MIN_USABLE_QUALITY
  ) {
    const summary = detectionRate < MIN_DETECTION_RATE
      ? '人体关键点未能持续识别，请保持身体入镜；重试后仍失败请改用人工观察。'
      : visibility < 0.62
        ? '关键点清晰度不足，请改善光线或减少遮挡。'
        : framing < 0.95
          ? '关键部位多次离开画面，请调整距离和取景范围。'
          : '有效姿态证据不足，请重新观察或改用人工记录。'
    return {
      score: null,
      confidence: quality,
      quality,
      summary,
      metrics: [
        `稳定帧 ${capturedFrames}/${attemptedFrames}`,
        `入镜完整度 ${percent(framing)}`,
        `姿态质量 ${percent(quality)}`,
      ],
      capturedFrames,
    }
  }

  const scale = median(frames.map((frame) => frame.bodyScale))
  const hipVerticalRange = robustRange(frames.map((frame) => frame.hipY)) / scale
  const hipHorizontalRange = robustRange(frames.map((frame) => frame.hipX)) / scale
  const shoulderSway = robustDeviation(
    frames.map((frame) => frame.shoulderX - frame.hipX),
  ) / scale
  const torsoTilt = median(frames.map((frame) => frame.torsoTilt))
  const shoulderWidths = frames.map((frame) => frame.shoulderWidth)
  const shoulderWidthChange = robustRange(shoulderWidths) / Math.max(0.04, quantile(shoulderWidths, 0.9))
  const ankleMotion = average([
    robustRange(frames.map((frame) => frame.leftAnkleX)),
    robustRange(frames.map((frame) => frame.rightAnkleX)),
  ]) / scale
  const wristMotion = Math.hypot(
    robustRange(frames.map((frame) => frame.wristX)),
    robustRange(frames.map((frame) => frame.wristY)),
  ) / scale
  const bothRaised = frames.map((frame) => frame.leftWristAbove && frame.rightWristAbove)
  const oneRaised = frames.map((frame) => frame.leftWristAbove || frame.rightWristAbove)
  const bothRaisedRatio = bothRaised.filter(Boolean).length / frames.length
  const oneRaisedRatio = oneRaised.filter(Boolean).length / frames.length
  const bothRaisedRun = longestTrueRun(bothRaised)
  const oneRaisedRun = longestTrueRun(oneRaised)
  const fingerGapChange = robustRange(frames.map((frame) => frame.fingerGap))

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
    if (bothRaisedRatio > 0.16 && bothRaisedRun >= 4) score = 0
    else if (oneRaisedRatio > 0.16 && oneRaisedRun >= 4) score = 1
    else if (wristMotion > 0.24) score = 2
    else score = 3
    summary = score === 0
      ? '左右手腕均曾高于对应肩部。'
      : '仅单侧或未检测到手腕越过肩部。'
    metrics = [
      `双侧抬臂帧占比 ${percent(bothRaisedRatio)}`,
      `单侧抬臂帧占比 ${percent(oneRaisedRatio)}`,
      `最长连续抬臂 ${Math.max(bothRaisedRun, oneRaisedRun)}帧`,
    ]
  } else {
    evidenceStrength = 0.58
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
    metrics: [
      ...metrics,
      `稳定帧 ${capturedFrames}/${attemptedFrames}`,
      `入镜完整度 ${percent(framing)}`,
      `姿态质量 ${percent(quality)}`,
    ],
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
  const durationMs = options.durationMs ?? 7200
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
    const result = landmarker.detectForVideo(video, now)
    const landmarks = result.landmarks[0]
    const frame = landmarks ? frameFromLandmarks(landmarks, taskIndex) : null
    const guidance = guidanceForFrame(frame, taskIndex)
    const isWarmup = now - startedAt < WARMUP_MS
    if (!isWarmup) {
      attemptedFrames += 1
      if (frame) frames.push(frame)
    }
    if (landmarks) {
      options.onFrame?.(landmarks, clamp((now - startedAt) / durationMs), guidance)
    } else {
      options.onFrame?.([], clamp((now - startedAt) / durationMs), guidance)
    }
  }

  return buildResult(taskIndex, frames, attemptedFrames)
}
