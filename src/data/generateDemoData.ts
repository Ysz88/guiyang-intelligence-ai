import { DIMENSION_META, DIMENSION_ORDER, TASK_DEFINITIONS } from './taskDefinitions'
import { createItemSelection } from './itemBank'
import { DEMO_STATE_VERSION } from './migrateDemoState'
import { evaluateAssessment } from '../rules/engine'
import type {
  AssessmentDraft,
  AssessmentRecord,
  DemoState,
  DimensionKey,
  Grade,
  LanguageBackground,
  Resident,
  TaskScore,
} from '../types'

const LANGUAGE_BACKGROUNDS: LanguageBackground[] = [
  '普通话',
  '地方口音普通话',
  '方言或民族语言',
  '未知或不愿填写',
]

const SERVICE_NEEDS = [
  '常规照护',
  '行动协助',
  '沟通支持',
  '视听辅助',
  '认知陪伴',
  '生活照护',
]

function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function scoreForSeverity(severity: Grade, random: () => number): Grade {
  const roll = random()
  if (severity === 0) return roll < 0.78 ? 0 : 1
  if (severity === 1) return roll < 0.25 ? 0 : roll < 0.82 ? 1 : 2
  if (severity === 2) return roll < 0.18 ? 1 : roll < 0.82 ? 2 : 3
  return roll < 0.22 ? 2 : 3
}

function taskScores(
  dimension: DimensionKey,
  severity: Grade,
  random: () => number,
): TaskScore[] {
  return TASK_DEFINITIONS[dimension].map(() => scoreForSeverity(severity, random))
}

function chooseSeverity(random: () => number): Grade {
  const roll = random()
  if (roll < 0.38) return 0
  if (roll < 0.76) return 1
  if (roll < 0.94) return 2
  return 3
}

export function createBlankDraft(
  residentId: string,
  languageBackground: LanguageBackground = '未知或不愿填写',
  selectionDate = new Date().toISOString().slice(0, 10),
): AssessmentDraft {
  return {
    residentId,
    inputMode: 'AI视频语音对话',
    consent: {
      accepted: false,
      person: '本人',
      allowAudio: true,
      allowVideo: true,
    },
    tasks: {
      mobility: Array(5).fill(null),
      speech: Array(3).fill(null),
      sensory: Array(3).fill(null),
      psychology: Array(5).fill(null),
      adl: Array(5).fill(null),
    },
    speechEvidence: {
      rawText: '',
      correctedText: '',
      confirmed: false,
      asrConfidence: null,
      languageBackground,
      languageNote: '',
    },
    poseQuality: null,
    aiEvidence: [],
    itemSelection: createItemSelection(residentId, selectionDate),
    fieldCheckDone: false,
    crisisFlag: false,
    crisisNote: '',
    conflictFlag: false,
    inspectorId: 'INS-DEMO-01',
  }
}

function highestNeed(draft: AssessmentDraft): string {
  const totals = DIMENSION_ORDER.map((dimension) => ({
    dimension,
    total: draft.tasks[dimension].reduce<number>(
      (sum, score) => sum + (score ?? 0),
      0,
    ),
  })).sort((a, b) => b.total - a.total)
  const top = totals[0]
  if (!top || top.total <= 2) return SERVICE_NEEDS[0]
  return `${DIMENSION_META[top.dimension].shortLabel}支持`
}

function dateForIndex(index: number) {
  const day = 7 - (index % 7)
  return `2026-08-${String(day).padStart(2, '0')}`
}

export function generateDemoState(): DemoState {
  const random = createRng(20260808)
  const residents: Resident[] = []
  const records: AssessmentRecord[] = []

  for (let index = 0; index < 60; index += 1) {
    const residentNumber = String(index + 1).padStart(3, '0')
    const residentId = `SIM-RES-${residentNumber}`
    const languageBackground = LANGUAGE_BACKGROUNDS[index % LANGUAGE_BACKGROUNDS.length]
    const hasRecord = index < 54
    const baseSeverity = chooseSeverity(random)
    const checkDate = dateForIndex(index)
    const draft = createBlankDraft(residentId, languageBackground, checkDate)

    draft.consent.accepted = true
    draft.consent.person = index % 8 === 0 ? '代理人' : '本人'
    draft.inputMode = index % 5 === 0 ? '护理人员代录' : 'AI视频语音对话'
    draft.tasks = Object.fromEntries(
      DIMENSION_ORDER.map((dimension, dimensionIndex) => {
        const offset = random() > 0.78 && dimensionIndex === index % 5 ? 1 : 0
        const severity = Math.min(3, baseSeverity + offset) as Grade
        return [dimension, taskScores(dimension, severity, random)]
      }),
    ) as AssessmentDraft['tasks']
    draft.speechEvidence = {
      rawText: index % 7 === 0 ? '今天早上我自个走到饭堂吃粥' : '今天早上我自己去餐厅吃饭',
      correctedText: '今天早上我自己去餐厅吃饭',
      confirmed: true,
      asrConfidence: index % 9 === 0 ? 0.67 : 0.91,
      languageBackground,
      languageNote: index % 7 === 0 ? '地方口音普通话，演示记录' : '',
    }
    draft.poseQuality = index % 11 === 0 ? 0.72 : 0.9
    draft.fieldCheckDone = true

    if (index === 46) {
      draft.crisisFlag = true
      draft.crisisNote = '模拟危机线索，流程停止并转人工'
    }
    if (index === 47) {
      draft.tasks.mobility = [1, null, null, 1, 0]
    }
    if (index === 48) {
      draft.conflictFlag = true
    }
    if (index === 49) {
      draft.fieldCheckDone = false
    }

    const evaluation = evaluateAssessment(draft)
    const needsReview =
      evaluation.status !== 'graded' ||
      evaluation.qualityAlerts.length > 0 ||
      draft.conflictFlag
    const status = hasRecord ? (needsReview ? '待复核' : '已确认') : '待检查'
    const previousGrade = Math.max(
      0,
      Math.min(3, baseSeverity + (index % 4 === 0 ? 1 : 0)),
    ) as Grade

    residents.push({
      id: residentId,
      archiveId: `SIM-ARCH-${residentNumber}`,
      displayName: `演示老人 ${residentNumber}`,
      age: 62 + ((index * 7) % 29),
      gender: index % 2 === 0 ? '女' : '男',
      room: `${String.fromCharCode(65 + (index % 3))}-${String(201 + (index % 18))}`,
      floor: `${(index % 3) + 2}层`,
      languageBackground,
      checkStatus: status,
      lastCheckDate: hasRecord ? checkDate : null,
      lastGrade: evaluation.overallGrade,
      previousGrade,
      mainNeed: highestNeed(draft),
      simulated: true,
    })

    if (hasRecord) {
      records.push({
        id: `SIM-REC-${residentNumber}`,
        residentId,
        checkDate,
        checkType: '年度检查',
        draft,
        evaluation,
        status,
        confirmedAt: status === '已确认' ? `${checkDate}T15:30:00+08:00` : null,
        confirmedBy: status === '已确认' ? 'INS-DEMO-01' : null,
        adjustmentReason: '',
        simulated: true,
      })
    }
  }

  return { residents, records, version: DEMO_STATE_VERSION }
}
