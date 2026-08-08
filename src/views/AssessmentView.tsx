import {
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  ClipboardPen,
  Eye,
  FileInput,
  Hand,
  Keyboard,
  LoaderCircle,
  Mic,
  MicOff,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Speech,
  Square,
  Volume2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ComplianceNote,
  EvaluationStatusBadge,
  GradeBadge,
  PageHeader,
} from '../components/common'
import { createBlankDraft } from '../data/generateDemoData'
import {
  DIMENSION_META,
  DIMENSION_ORDER,
  TASK_DEFINITIONS,
} from '../data/taskDefinitions'
import { evaluateAssessment } from '../rules/engine'
import {
  createSpeechRecognizer,
  speakPrompt,
  startCamera,
  stopCamera,
  stopSpeaking,
} from '../services/browserAi'
import {
  loadPoseLandmarker,
  observeMobilityTask,
  POSE_CONNECTIONS,
  type PoseFrameGuidance,
} from '../services/poseAssessment'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type {
  AiTaskEvidence,
  AssessmentDraft,
  AssessmentRecord,
  DimensionKey,
  InputMode,
  LanguageBackground,
  Resident,
  TaskScore,
} from '../types'

const INPUT_MODES: Array<{
  value: InputMode
  label: string
  note: string
  icon: typeof Sparkles
}> = [
  { value: 'AI视频语音对话', label: 'AI视频语音对话', note: '姿态识别、图卡与语音交互', icon: Sparkles },
  { value: '触屏自填', label: '触屏自填', note: '老人或家属直接选择', icon: Hand },
  { value: '护理人员代录', label: '护理人员代录', note: '现场观察后结构化记录', icon: ClipboardPen },
  { value: '历史结果导入', label: '历史结果导入', note: '导入后仍需逐项确认', icon: FileInput },
]

const VISION_CARDS = ['山', '水', '人', '家'] as const

type PoseAnalysisStatus = 'idle' | 'loading' | 'analyzing'
type VisionCardPhase = 'ready' | 'showing' | 'answer'

function scoreForVisionCount(count: number): 0 | 1 | 2 | 3 {
  if (count >= 4) return 0
  if (count === 3) return 1
  if (count >= 1) return 2
  return 3
}

function upsertEvidence(
  evidence: AiTaskEvidence[] | undefined,
  next: AiTaskEvidence,
) {
  return [...(evidence ?? []).filter((item) => item.taskId !== next.taskId), next]
}

const LANGUAGE_OPTIONS: LanguageBackground[] = [
  '普通话',
  '地方口音普通话',
  '方言或民族语言',
  '未知或不愿填写',
]

function recordIdFor(residentId: string) {
  return residentId.replace('SIM-RES-', 'SIM-REC-')
}

export function AssessmentView({
  residents,
  selectedResident,
  onSelectResident,
  onSaveRecord,
  onOpenReviews,
}: {
  residents: Resident[]
  selectedResident: Resident | null
  onSelectResident: (residentId: string) => void
  onSaveRecord: (record: AssessmentRecord) => void
  onOpenReviews: () => void
}) {
  const [draft, setDraft] = useState<AssessmentDraft>(() =>
    createBlankDraft(selectedResident?.id ?? residents[0]?.id ?? ''),
  )
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('mobility')
  const [activeTaskIndex, setActiveTaskIndex] = useState(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraMessage, setCameraMessage] = useState('摄像头未开启')
  const [poseStatus, setPoseStatus] = useState<PoseAnalysisStatus>('idle')
  const [poseProgress, setPoseProgress] = useState(0)
  const [poseGuidance, setPoseGuidance] = useState<PoseFrameGuidance | null>(null)
  const [visionPhase, setVisionPhase] = useState<VisionCardPhase>('ready')
  const [visionCardIndex, setVisionCardIndex] = useState(0)
  const [visionRecognizedCount, setVisionRecognizedCount] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [saved, setSaved] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const poseCanvasRef = useRef<HTMLCanvasElement>(null)
  const poseAbortRef = useRef<AbortController | null>(null)
  const visionRunRef = useRef(0)
  const recognizerRef = useRef<ReturnType<typeof createSpeechRecognizer>>(null)

  useEffect(() => {
    if (!selectedResident && residents[0]) onSelectResident(residents[0].id)
  }, [onSelectResident, residents, selectedResident])

  useEffect(() => {
    if (!selectedResident) return
    setDraft(createBlankDraft(selectedResident.id, selectedResident.languageBackground))
    setActiveDimension('mobility')
    setActiveTaskIndex(0)
    setSaved(false)
    stopCamera(cameraStream)
    poseAbortRef.current?.abort()
    visionRunRef.current += 1
    setCameraStream(null)
    setCameraMessage('摄像头未开启')
    setPoseStatus('idle')
    setPoseProgress(0)
    setPoseGuidance(null)
    setVisionPhase('ready')
    setVisionRecognizedCount(null)
  // cameraStream is intentionally excluded: changing residents is the reset boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResident?.id])

  useEffect(() => () => {
    stopCamera(cameraStream)
  }, [cameraStream])

  useEffect(() => () => {
    poseAbortRef.current?.abort()
    visionRunRef.current += 1
    recognizerRef.current?.stop()
    stopSpeaking()
  }, [])

  const evaluation = useMemo(() => evaluateAssessment(draft), [draft])
  const activeTasks = TASK_DEFINITIONS[activeDimension]
  const activeTask = activeTasks[activeTaskIndex]
  const currentEvidence = (draft.aiEvidence ?? []).find(
    (item) => item.taskId === activeTask.id,
  )
  const isVisionCardTask = activeTask.id === 'ST-01'

  useEffect(() => {
    poseAbortRef.current?.abort()
    setPoseStatus('idle')
    setPoseProgress(0)
    setPoseGuidance(null)
    visionRunRef.current += 1
    setVisionPhase('ready')
    setVisionCardIndex(0)
    setVisionRecognizedCount(null)
    const canvas = poseCanvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }, [activeTask.id])

  const completedTasks = DIMENSION_ORDER.reduce(
    (total, dimension) => total + draft.tasks[dimension].filter((score) => score !== null).length,
    0,
  )
  const totalTasks = DIMENSION_ORDER.reduce(
    (total, dimension) => total + TASK_DEFINITIONS[dimension].length,
    0,
  )

  const updateDraft = <K extends keyof AssessmentDraft>(key: K, value: AssessmentDraft[K]) => {
    setSaved(false)
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const updateTaskScore = (dimension: DimensionKey, index: number, score: TaskScore) => {
    const taskId = TASK_DEFINITIONS[dimension][index].id
    setSaved(false)
    setDraft((current) => ({
      ...current,
      tasks: {
        ...current.tasks,
        [dimension]: current.tasks[dimension].map((item, itemIndex) =>
          itemIndex === index ? score : item,
        ),
      },
      aiEvidence: (current.aiEvidence ?? []).map((item) =>
        item.taskId === taskId
          ? {
              ...item,
              reviewStatus: item.suggestedScore === score ? '已确认' : '已修改',
            }
          : item,
      ),
    }))
  }

  const selectDimension = (dimension: DimensionKey) => {
    poseAbortRef.current?.abort()
    setPoseStatus('idle')
    setPoseProgress(0)
    if (dimension !== 'mobility' && cameraStream) {
      stopCamera(cameraStream)
      setCameraStream(null)
      setCameraMessage('摄像头已关闭，未保存任何原始视频')
    }
    setActiveDimension(dimension)
    const firstMissing = draft.tasks[dimension].findIndex((score) => score === null)
    setActiveTaskIndex(firstMissing >= 0 ? firstMissing : 0)
  }

  const moveToNextTask = () => {
    if (activeTaskIndex < activeTasks.length - 1) {
      setActiveTaskIndex((index) => index + 1)
      return
    }
    const dimensionIndex = DIMENSION_ORDER.indexOf(activeDimension)
    if (dimensionIndex < DIMENSION_ORDER.length - 1) {
      selectDimension(DIMENSION_ORDER[dimensionIndex + 1])
    }
  }

  const clearPoseOverlay = () => {
    const canvas = poseCanvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  const drawPoseOverlay = (landmarks: NormalizedLandmark[]) => {
    const canvas = poseCanvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const width = video.videoWidth || 640
    const height = video.videoHeight || 480
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    if (landmarks.length === 0) return

    context.lineWidth = Math.max(2, width / 320)
    context.strokeStyle = '#55e0b6'
    for (const [start, end] of POSE_CONNECTIONS) {
      const first = landmarks[start]
      const second = landmarks[end]
      if (!first || !second || first.visibility < 0.45 || second.visibility < 0.45) continue
      context.beginPath()
      context.moveTo(first.x * width, first.y * height)
      context.lineTo(second.x * width, second.y * height)
      context.stroke()
    }
    context.fillStyle = '#ffffff'
    for (const point of landmarks) {
      if (point.visibility < 0.55) continue
      context.beginPath()
      context.arc(point.x * width, point.y * height, Math.max(2.5, width / 230), 0, Math.PI * 2)
      context.fill()
    }
  }

  const closeCamera = () => {
    poseAbortRef.current?.abort()
    poseAbortRef.current = null
    stopCamera(cameraStream)
    setCameraStream(null)
    setPoseStatus('idle')
    setPoseProgress(0)
    setPoseGuidance(null)
    clearPoseOverlay()
    setCameraMessage('摄像头已关闭，未保存任何原始视频')
  }

  const ensureCamera = async () => {
    if (cameraStream) return cameraStream
    if (!videoRef.current) return null
    const stream = await startCamera(videoRef.current)
    setCameraStream(stream)
    setPoseGuidance(null)
    setCameraMessage('实时画面已开启，可开始AI观察')
    return stream
  }

  const toggleCamera = async () => {
    if (cameraStream) {
      closeCamera()
      return
    }
    try {
      await ensureCamera()
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : '无法开启摄像头')
    }
  }

  const startPoseObservation = async () => {
    if (poseStatus !== 'idle') {
      poseAbortRef.current?.abort()
      setPoseStatus('idle')
      setPoseProgress(0)
      setPoseGuidance(null)
      setCameraMessage('AI观察已停止，可改用人工记录')
      return
    }
    if (activeDimension !== 'mobility' || !canUseCamera) return

    try {
      const stream = await ensureCamera()
      if (!stream || !videoRef.current) return
      const controller = new AbortController()
      poseAbortRef.current = controller
      setPoseStatus('loading')
      setPoseProgress(0)
      setPoseGuidance(null)
      setCameraMessage('正在本机加载高精度姿态模型…')
      await loadPoseLandmarker()
      if (controller.signal.aborted) return
      setPoseStatus('analyzing')
      setCameraMessage('AI正在观察当前动作，请保持全身在画面内')

      const result = await observeMobilityTask(videoRef.current, activeTaskIndex, {
        signal: controller.signal,
        onFrame: (landmarks, progress, guidance) => {
          drawPoseOverlay(landmarks)
          setPoseProgress(progress)
          setPoseGuidance(guidance)
        },
      })
      const evidence: AiTaskEvidence = {
        taskId: activeTask.id,
        source: 'MediaPipe姿态',
        suggestedScore: result.score,
        confidence: result.confidence,
        quality: result.quality,
        summary: result.summary,
        metrics: result.metrics,
        reviewStatus: result.score === null ? '转人工' : '待确认',
        capturedAt: new Date().toISOString(),
      }

      setSaved(false)
      setDraft((current) => ({
        ...current,
        poseQuality: Number(result.quality.toFixed(2)),
        tasks: result.score === null
          ? current.tasks
          : {
              ...current.tasks,
              mobility: current.tasks.mobility.map((score, index) =>
                index === activeTaskIndex ? result.score : score,
              ),
            },
        aiEvidence: upsertEvidence(current.aiEvidence, evidence),
      }))
      setCameraMessage(result.score === null
        ? result.summary
        : `AI已预选${result.score}档，等待检查人员确认`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setCameraMessage(error instanceof Error ? `AI观察不可用：${error.message}` : 'AI观察不可用，请人工记录')
    } finally {
      poseAbortRef.current = null
      setPoseStatus('idle')
      setPoseProgress(0)
    }
  }

  const confirmCurrentEvidence = () => {
    setSaved(false)
    setDraft((current) => ({
      ...current,
      aiEvidence: (current.aiEvidence ?? []).map((item) =>
        item.taskId === activeTask.id && item.suggestedScore !== null
          ? { ...item, reviewStatus: '已确认' }
          : item,
      ),
    }))
  }

  const applyVisionCardResult = (
    count: number,
    method: 'touch' | 'speech',
    speechConfidence: number | null = null,
  ) => {
    const normalizedCount = Math.max(0, Math.min(4, Math.round(count)))
    const score = scoreForVisionCount(normalizedCount)
    const confidence = method === 'touch' ? 1 : (speechConfidence ?? 0.65)
    setVisionRecognizedCount(normalizedCount)
    setSaved(false)
    setDraft((current) => ({
      ...current,
      tasks: {
        ...current.tasks,
        sensory: current.tasks.sensory.map((item, index) => index === 0 ? score : item),
      },
      aiEvidence: upsertEvidence(current.aiEvidence, {
        taskId: 'ST-01',
        source: '大字图卡',
        suggestedScore: score,
        confidence,
        quality: method === 'speech' ? speechConfidence : null,
        summary: method === 'speech'
          ? `语音回答匹配到${normalizedCount}个目标字，已按固定规则预选${score}档。`
          : `检查人员确认辨认${normalizedCount}个字，已按固定规则换算为${score}档。`,
        metrics: [`目标字 4个`, `辨认 ${normalizedCount}个`, method === 'speech' ? '来源 语音匹配' : '来源 现场确认'],
        reviewStatus: method === 'touch' ? '已确认' : '待确认',
        capturedAt: new Date().toISOString(),
      }),
    }))
  }

  const startVisionCardTest = async () => {
    const runId = visionRunRef.current + 1
    visionRunRef.current = runId
    setVisionRecognizedCount(null)
    setVisionPhase('showing')
    for (let index = 0; index < VISION_CARDS.length; index += 1) {
      if (visionRunRef.current !== runId) return
      setVisionCardIndex(index)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1300))
    }
    if (visionRunRef.current !== runId) return
    setVisionPhase('answer')
    speakPrompt('请说出刚才看到的四个大字')
  }

  const startListening = () => {
    if (listening) {
      recognizerRef.current?.stop()
      setListening(false)
      return
    }
    const recognizer = createSpeechRecognizer(
      (text, confidence) => {
        if (isVisionCardTask && visionPhase === 'answer') {
          const count = VISION_CARDS.filter((character) => text.includes(character)).length
          applyVisionCardResult(count, 'speech', confidence)
        }
        setDraft((current) => ({
          ...current,
          speechEvidence: {
            ...current.speechEvidence,
            rawText: text,
            correctedText: text,
            asrConfidence: confidence,
            confirmed: false,
          },
        }))
      },
      () => setListening(false),
    )
    if (!recognizer) {
      setDraft((current) => ({
        ...current,
        speechEvidence: {
          ...current.speechEvidence,
          languageNote: '当前浏览器不支持语音识别，请手动输入。',
        },
      }))
      return
    }
    recognizerRef.current = recognizer
    setListening(true)
    recognizer.start()
  }

  const importExample = () => {
    setDraft((current) => ({
      ...current,
      tasks: {
        mobility: [0, 1, 1, 0, 1],
        speech: [1, 1, 0],
        sensory: [0, 1, 1],
        psychology: [0, 1, 0, 1, 0],
        adl: [0, 1, 1, 1, 1],
      },
      speechEvidence: {
        ...current.speechEvidence,
        rawText: '今朝我自个行到饭堂食早饭',
        correctedText: '今天早上我自己走到食堂吃早饭',
        asrConfidence: 0.72,
        confirmed: false,
        languageNote: '模拟广西地方口音转写，需人工核对修正文。',
      },
      poseQuality: 0.88,
    }))
  }

  const saveAssessment = () => {
    if (!selectedResident) return
    const nextEvaluation = evaluateAssessment(draft)
    const status =
      nextEvaluation.status === 'graded' && nextEvaluation.qualityAlerts.length === 0
        ? '待确认'
        : '待复核'
    onSaveRecord({
      id: recordIdFor(selectedResident.id),
      residentId: selectedResident.id,
      checkDate: new Date().toISOString().slice(0, 10),
      checkType: '年度检查',
      draft,
      evaluation: nextEvaluation,
      status,
      confirmedAt: null,
      confirmedBy: null,
      adjustmentReason: '',
      simulated: true,
    })
    setSaved(true)
  }

  if (!selectedResident) return null

  const canUseCamera =
    draft.inputMode === 'AI视频语音对话' &&
    draft.consent.accepted &&
    draft.consent.allowVideo

  return (
    <div className="view-stack assessment-page">
      <PageHeader
        title="年度能力检查"
        description="固定任务采集，AI辅助整理，检查人员确认后再进入确定性规则。"
        actions={
          <div className="assessment-person-select">
            <label htmlFor="resident-select">当前档案</label>
            <select
              id="resident-select"
              value={selectedResident.id}
              onChange={(event) => onSelectResident(event.target.value)}
            >
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.displayName} · {resident.room}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <ComplianceNote>
        本系统用于养老服务年度能力检查辅助，不作疾病诊断；姿态与语音只生成预选建议，检查人员确认后才进入规则计算。
      </ComplianceNote>

      <section className="assessment-setup panel">
        <div className="section-heading">
          <div><span className="section-kicker">输入方式</span><h2>选择老人更容易完成的方式</h2></div>
          <span className="completion-label">已记录 {completedTasks}/{totalTasks} 项</span>
        </div>
        <div className="input-mode-grid">
          {INPUT_MODES.map((mode) => {
            const Icon = mode.icon
            return (
              <button
                key={mode.value}
                type="button"
                className={draft.inputMode === mode.value ? 'input-mode active' : 'input-mode'}
                onClick={() => updateDraft('inputMode', mode.value)}
              >
                <Icon size={19} aria-hidden="true" />
                <span><strong>{mode.label}</strong><small>{mode.note}</small></span>
                {draft.inputMode === mode.value ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            )
          })}
        </div>

        <div className="consent-row">
          <label className="check-control">
            <input
              type="checkbox"
              checked={draft.consent.accepted}
              onChange={(event) =>
                updateDraft('consent', { ...draft.consent, accepted: event.target.checked })
              }
            />
            <span>已向本人或代理人说明用途并获得同意</span>
          </label>
          <label>
            授权人
            <select
              value={draft.consent.person}
              onChange={(event) =>
                updateDraft('consent', {
                  ...draft.consent,
                  person: event.target.value as AssessmentDraft['consent']['person'],
                })
              }
            >
              <option value="本人">本人</option>
              <option value="代理人">代理人</option>
              <option value="未获得">未获得</option>
            </select>
          </label>
          <label className="check-control">
            <input
              type="checkbox"
              checked={draft.consent.allowAudio}
              onChange={(event) =>
                updateDraft('consent', { ...draft.consent, allowAudio: event.target.checked })
              }
            />
            <span>允许使用麦克风</span>
          </label>
          <label className="check-control">
            <input
              type="checkbox"
              checked={draft.consent.allowVideo}
              onChange={(event) =>
                updateDraft('consent', { ...draft.consent, allowVideo: event.target.checked })
              }
            />
            <span>允许使用摄像头</span>
          </label>
          {draft.inputMode === '历史结果导入' ? (
            <button className="secondary-button" type="button" onClick={importExample}>
              <FileInput size={16} aria-hidden="true" />载入模拟历史记录
            </button>
          ) : null}
        </div>
      </section>

      <div className="assessment-layout">
        <div className="assessment-main">
          <section className="interaction-panel panel">
            <div className="dimension-tabs" role="tablist" aria-label="能力维度">
              {DIMENSION_ORDER.map((dimension) => {
                const scores = draft.tasks[dimension]
                const done = scores.filter((score) => score !== null).length
                return (
                  <button
                    key={dimension}
                    type="button"
                    role="tab"
                    aria-selected={activeDimension === dimension}
                    className={activeDimension === dimension ? 'active' : ''}
                    onClick={() => selectDimension(dimension)}
                  >
                    <span>{DIMENSION_META[dimension].shortLabel}</span>
                    <small>{done}/{scores.length}</small>
                  </button>
                )
              })}
            </div>

            <div className="interaction-stage">
              {activeDimension === 'mobility' ? (
                <div className="video-stage">
                  <video ref={videoRef} muted playsInline />
                  <canvas ref={poseCanvasRef} className="pose-overlay" aria-hidden="true" />
                  {cameraStream ? (
                    <div
                      className={`pose-framing-guide ${activeTaskIndex === 1 || activeTaskIndex === 2 ? 'full-body' : 'upper-body'} ${poseGuidance?.level ?? ''}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {!cameraStream ? (
                    <div className="video-placeholder">
                      <CameraOff size={30} aria-hidden="true" />
                      <strong>{canUseCamera ? '开启摄像头后由AI观察动作' : '当前使用无视频方式'}</strong>
                      <span>模型在本机运行，不录制、不上传、不保存原始视频</span>
                    </div>
                  ) : null}
                  {poseStatus !== 'idle' ? (
                    <div className="pose-progress" role="status">
                      <span>{poseStatus === 'loading' ? '加载姿态模型' : '分析当前动作'}</span>
                      <strong>{poseStatus === 'loading' ? '…' : `${Math.round(poseProgress * 100)}%`}</strong>
                      <small className={poseGuidance?.level ?? ''}>
                        {poseStatus === 'loading'
                          ? '首次加载可能需要数秒'
                          : poseGuidance?.message ?? '请保持在取景框内'}
                      </small>
                      <div><i style={{ width: `${Math.max(4, poseProgress * 100)}%` }} /></div>
                    </div>
                  ) : null}
                  <div className="video-status">{cameraMessage}</div>
                  <div className="video-toolbar">
                    <button
                      className="pose-analysis-button"
                      type="button"
                      onClick={startPoseObservation}
                      disabled={!canUseCamera}
                    >
                      {poseStatus === 'idle'
                        ? <ScanLine size={17} aria-hidden="true" />
                        : <LoaderCircle className="spin" size={17} aria-hidden="true" />}
                      {poseStatus === 'idle' ? '开始AI观察' : '停止观察'}
                    </button>
                    <button
                      className="video-control"
                      type="button"
                      onClick={toggleCamera}
                      disabled={!canUseCamera}
                      aria-label={cameraStream ? '关闭摄像头' : '开启摄像头'}
                      title={cameraStream ? '关闭摄像头' : '开启摄像头'}
                    >
                      {cameraStream ? <Square size={17} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              ) : isVisionCardTask ? (
                <div className="vision-card-stage">
                  <div className="vision-card-heading">
                    <span><Eye size={18} aria-hidden="true" />大字图卡</span>
                    <small>共4张</small>
                  </div>
                  <div className={`vision-card-screen ${visionPhase}`} aria-live="polite">
                    {visionPhase === 'ready' ? (
                      <>
                        <Eye size={35} aria-hidden="true" />
                        <strong>图卡测试准备</strong>
                        <span>点击开始后，每张大字显示1.3秒</span>
                      </>
                    ) : visionPhase === 'showing' ? (
                      <>
                        <strong className="vision-character">{VISION_CARDS[visionCardIndex]}</strong>
                        <span>第 {visionCardIndex + 1} / {VISION_CARDS.length} 张</span>
                      </>
                    ) : (
                      <>
                        <strong className="vision-question">?</strong>
                        <span>请说出刚才看到的字，或由检查人员记录数量</span>
                      </>
                    )}
                  </div>
                  <div className="vision-card-controls">
                    {visionPhase === 'ready' ? (
                      <button className="vision-start-button" type="button" onClick={startVisionCardTest}>
                        <Eye size={17} aria-hidden="true" />开始显示图卡
                      </button>
                    ) : visionPhase === 'showing' ? (
                      <div className="vision-card-dots" aria-label="图卡显示进度">
                        {VISION_CARDS.map((card, index) => (
                          <i key={card} className={index <= visionCardIndex ? 'active' : ''} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="recognized-count" aria-label="辨认大字数量">
                          <span>辨认数量</span>
                          {[0, 1, 2, 3, 4].map((count) => (
                            <button
                              key={count}
                              type="button"
                              className={visionRecognizedCount === count ? 'active' : ''}
                              onClick={() => applyVisionCardResult(count, 'touch')}
                              aria-label={`辨认${count}个字`}
                            >
                              {count}
                            </button>
                          ))}
                        </div>
                        <button className="icon-button" type="button" onClick={startVisionCardTest} title="重新显示图卡" aria-label="重新显示图卡">
                          <RotateCcw size={17} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="task-support-stage">
                  {activeDimension === 'sensory'
                    ? <Volume2 size={34} aria-hidden="true" />
                    : <Sparkles size={34} aria-hidden="true" />}
                  <strong>{activeTask.label}</strong>
                  <span>本项通过播报、语音作答或现场观察完成</span>
                </div>
              )}

              <div className="prompt-stage">
                <div className="task-position">
                  <span>{DIMENSION_META[activeDimension].label}</span>
                  <strong>{activeTaskIndex + 1}/{activeTasks.length}</strong>
                </div>
                <h2>{activeTask.label}</h2>
                <p className="prompt-text">{activeTask.prompt}</p>
                <div className="prompt-actions">
                  <button className="secondary-button" type="button" onClick={() => speakPrompt(activeTask.prompt)}>
                    <Volume2 size={17} aria-hidden="true" />播报问题
                  </button>
                  <button
                    className={listening ? 'secondary-button listening' : 'secondary-button'}
                    type="button"
                    onClick={startListening}
                    disabled={!draft.consent.allowAudio || !draft.consent.accepted}
                  >
                    {listening ? <MicOff size={17} aria-hidden="true" /> : <Mic size={17} aria-hidden="true" />}
                    {listening ? '停止识别' : '语音作答'}
                  </button>
                </div>
                {currentEvidence ? (
                  <div className={`ai-suggestion ${currentEvidence.reviewStatus === '转人工' ? 'manual' : ''}`}>
                    <Sparkles size={18} aria-hidden="true" />
                    <div>
                      <span>{currentEvidence.source}</span>
                      <strong>
                        {currentEvidence.suggestedScore === null
                          ? '未自动选档，转人工观察'
                          : `已预选 ${currentEvidence.suggestedScore} 档 · ${currentEvidence.reviewStatus}`}
                      </strong>
                      <p>{currentEvidence.summary}</p>
                      <small>
                        置信度 {Math.round(currentEvidence.confidence * 100)}%
                        {currentEvidence.metrics.length > 0 ? ` · ${currentEvidence.metrics.join(' · ')}` : ''}
                      </small>
                    </div>
                    {currentEvidence.suggestedScore !== null && currentEvidence.reviewStatus === '待确认' ? (
                      <button type="button" onClick={confirmCurrentEvidence}>确认建议</button>
                    ) : null}
                  </div>
                ) : null}
                <div className="score-options" aria-label={`${activeTask.label}记录结果`}>
                  {activeTask.levels.map((level, score) => {
                    const isSelected = draft.tasks[activeDimension][activeTaskIndex] === score
                    const isSuggested = currentEvidence?.suggestedScore === score
                    return (
                      <button
                        key={level}
                        type="button"
                        className={`${isSelected ? 'selected' : ''}${isSuggested ? ' ai-suggested' : ''}`}
                        onClick={() => updateTaskScore(activeDimension, activeTaskIndex, score as TaskScore)}
                      >
                        <span>{score}</span>
                        <strong>{level}</strong>
                        {isSuggested ? <small>AI建议</small> : null}
                      </button>
                    )
                  })}
                </div>
                <div className="task-navigation">
                  <div className="task-dots">
                    {activeTasks.map((task, index) => (
                      <button
                        key={task.id}
                        type="button"
                        className={index === activeTaskIndex ? 'active' : draft.tasks[activeDimension][index] !== null ? 'done' : ''}
                        onClick={() => setActiveTaskIndex(index)}
                        aria-label={`${task.label}${draft.tasks[activeDimension][index] === null ? '未记录' : '已记录'}`}
                      />
                    ))}
                  </div>
                  <button className="text-button" type="button" onClick={moveToNextTask}>
                    下一项 <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="panel evidence-panel">
            <div className="section-heading">
              <div><span className="section-kicker">语音与地方语言质控</span><h2>原文、修正文与人工确认</h2></div>
              <Keyboard size={19} aria-hidden="true" />
            </div>
            <div className="evidence-grid">
              <label>
                ASR原文或老人自述
                <textarea
                  value={draft.speechEvidence.rawText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: {
                        ...current.speechEvidence,
                        rawText: event.target.value,
                        confirmed: false,
                      },
                    }))
                  }
                  placeholder="可由语音识别生成，也可直接输入"
                />
              </label>
              <label>
                人工修正文
                <textarea
                  value={draft.speechEvidence.correctedText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: {
                        ...current.speechEvidence,
                        correctedText: event.target.value,
                        confirmed: false,
                      },
                    }))
                  }
                  placeholder="按老人真实表达修正，不改变原意"
                />
              </label>
            </div>
            <div className="evidence-controls">
              <label>
                语言使用背景
                <select
                  value={draft.speechEvidence.languageBackground}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: {
                        ...current.speechEvidence,
                        languageBackground: event.target.value as LanguageBackground,
                      },
                    }))
                  }
                >
                  {LANGUAGE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>
                语言说明（可选）
                <input
                  value={draft.speechEvidence.languageNote}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: { ...current.speechEvidence, languageNote: event.target.value },
                    }))
                  }
                  placeholder="如桂柳话、壮语或地方口音"
                />
              </label>
              <label>
                ASR置信度
                <input
                  value={draft.speechEvidence.asrConfidence ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: {
                        ...current.speechEvidence,
                        asrConfidence: event.target.value === '' ? null : Number(event.target.value),
                      },
                    }))
                  }
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  placeholder="0-1"
                />
              </label>
              <label className="check-control confirm-transcript">
                <input
                  type="checkbox"
                  checked={draft.speechEvidence.confirmed}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      speechEvidence: { ...current.speechEvidence, confirmed: event.target.checked },
                    }))
                  }
                />
                <span>已向老人或护理人员复述并确认</span>
              </label>
            </div>
          </section>

          <section className="panel final-check-panel">
            <div className="section-heading">
              <div><span className="section-kicker">现场确认门</span><h2>提交规则计算前的最后核对</h2></div>
            </div>
            <div className="final-check-grid">
              <label>
                检查人员编号
                <input value={draft.inspectorId} onChange={(event) => updateDraft('inspectorId', event.target.value)} />
              </label>
              <label>
                姿态画面质量（AI自动写入，可修正）
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={draft.poseQuality ?? ''}
                  onChange={(event) => updateDraft('poseQuality', event.target.value === '' ? null : Number(event.target.value))}
                  placeholder="0-1，人工观察可留空"
                />
              </label>
              <label className="check-control">
                <input type="checkbox" checked={draft.conflictFlag} onChange={(event) => updateDraft('conflictFlag', event.target.checked)} />
                <span>与历史结果存在明显冲突</span>
              </label>
              <label className="check-control crisis-check">
                <input type="checkbox" checked={draft.crisisFlag} onChange={(event) => updateDraft('crisisFlag', event.target.checked)} />
                <span>发现心理危机、自伤或伤人线索</span>
              </label>
            </div>
            {draft.crisisFlag ? (
              <label className="full-width-field">
                危机线索说明
                <textarea value={draft.crisisNote} onChange={(event) => updateDraft('crisisNote', event.target.value)} placeholder="只记录处置所需的最小必要信息" />
              </label>
            ) : null}
            <label className="field-confirmation">
              <input type="checkbox" checked={draft.fieldCheckDone} onChange={(event) => updateDraft('fieldCheckDone', event.target.checked)} />
              <span><strong>我已逐项核对全部结构化字段</strong><small>未经检查人员确认的数据视同缺项，AI不能代替此确认。</small></span>
            </label>
          </section>
        </div>

        <aside className="assessment-summary">
          <section className="panel sticky-summary">
            <div className="section-heading">
              <div><span className="section-kicker">实时规则预览</span><h2>关注等级建议</h2></div>
              <EvaluationStatusBadge status={evaluation.status} />
            </div>
            <div className="overall-result">
              <span>总体建议</span>
              <GradeBadge grade={evaluation.overallGrade} />
              <small>{evaluation.ruleVersion}</small>
            </div>
            <div className="dimension-results">
              {DIMENSION_ORDER.map((dimension) => (
                <div key={dimension}>
                  <span>{DIMENSION_META[dimension].label}</span>
                  <GradeBadge grade={evaluation.dimensions[dimension].grade} />
                </div>
              ))}
            </div>
            {evaluation.reviewReasons.length > 0 || evaluation.qualityAlerts.length > 0 ? (
              <div className="alert-list">
                {[...evaluation.reviewReasons, ...evaluation.qualityAlerts].map((item) => (
                  <div key={item}><Speech size={15} aria-hidden="true" /><span>{item}</span></div>
                ))}
              </div>
            ) : (
              <div className="ready-note"><Check size={16} aria-hidden="true" />规则计算完成，仍需检查人员复核确认。</div>
            )}
            <div className="summary-actions">
              <button className="primary-button" type="button" onClick={saveAssessment}>
                <Save size={17} aria-hidden="true" />保存并进入复核
              </button>
              {saved ? (
                <button className="secondary-button" type="button" onClick={onOpenReviews}>
                  查看复核队列 <ChevronRight size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <p className="responsibility-footnote">AI可以预选单项记录但不能确认或改写规则结果；等级由版本化规则计算，最终由人员确认。</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
