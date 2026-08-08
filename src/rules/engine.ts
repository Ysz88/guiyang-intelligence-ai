import { DIMENSION_META, DIMENSION_ORDER, TASK_DEFINITIONS } from '../data/taskDefinitions'
import type {
  AssessmentDraft,
  DimensionKey,
  DimensionResult,
  Evaluation,
  Grade,
} from '../types'

export const RULE_VERSION = 'GYZJ-R-20260808-01'

const emptyDimensionResult = (dimension: DimensionKey): DimensionResult => ({
  dimension,
  grade: null,
  normalizedSum: null,
  missingCount: 0,
  status: 'manual',
  hitRules: [],
})

function gradeFromSum(expected: number, sum: number): Grade {
  if (expected === 5) {
    if (sum <= 1) return 0
    if (sum <= 5) return 1
    if (sum <= 10) return 2
    return 3
  }

  if (sum <= 1) return 0
  if (sum <= 3) return 1
  if (sum <= 6) return 2
  return 3
}

function evaluateDimension(
  dimension: DimensionKey,
  scores: AssessmentDraft['tasks'][DimensionKey],
): DimensionResult {
  const expected = TASK_DEFINITIONS[dimension].length
  const valid = scores.filter((score): score is Grade => score !== null)
  const missingCount = expected - valid.length
  const label = DIMENSION_META[dimension].shortLabel

  if (valid.length < 2) {
    return {
      ...emptyDimensionResult(dimension),
      missingCount,
      hitRules: [`D-01b ${label}有效任务不足2项`],
    }
  }

  if (missingCount > expected / 3) {
    return {
      ...emptyDimensionResult(dimension),
      missingCount,
      status: 'rejected',
      hitRules: [`D-01 ${label}缺项超过三分之一`],
    }
  }

  const rawSum = valid.reduce<number>((total, score) => total + score, 0)
  const normalizedSum = Math.round((rawSum * expected) / valid.length)
  let grade = gradeFromSum(expected, normalizedSum)
  const hitRules = [`A-${dimension.toUpperCase()} 加和分段`]

  if (valid.some((score) => score === 3) && grade < 2) {
    grade = 2
    hitRules.push('A-T1 单项3档托底')
  }

  return {
    dimension,
    grade,
    normalizedSum,
    missingCount,
    status: 'graded',
    hitRules,
  }
}

export function evaluateAssessment(draft: AssessmentDraft): Evaluation {
  const dimensions = Object.fromEntries(
    DIMENSION_ORDER.map((dimension) => [
      dimension,
      evaluateDimension(dimension, draft.tasks[dimension]),
    ]),
  ) as Record<DimensionKey, DimensionResult>

  const hitRules = DIMENSION_ORDER.flatMap(
    (dimension) => dimensions[dimension].hitRules,
  )
  const missingItems = DIMENSION_ORDER.flatMap((dimension) =>
    draft.tasks[dimension]
      .map((score, index) =>
        score === null ? TASK_DEFINITIONS[dimension][index].id : null,
      )
      .filter((item): item is string => item !== null),
  )
  const qualityAlerts: string[] = []
  const reviewReasons: string[] = []

  if (draft.speechEvidence.asrConfidence !== null && draft.speechEvidence.asrConfidence < 0.85) {
    qualityAlerts.push('ASR置信度低于0.85，仅提醒人工核对，不影响评分')
    hitRules.push('D-02 ASR低置信度提醒')
  }
  if (draft.poseQuality !== null && draft.poseQuality < 0.8) {
    qualityAlerts.push('姿态关键点质量低于0.8，建议改用现场观察记录')
    hitRules.push('D-02 姿态质量提醒')
  }
  if (draft.conflictFlag) {
    reviewReasons.push('跨次结果存在冲突，需要人工解释')
    hitRules.push('HX-08 跨次冲突')
  }

  if (draft.crisisFlag) {
    reviewReasons.push(draft.crisisNote || '心理与认知任务出现危机线索')
    return {
      status: 'crisis',
      overallGrade: null,
      dimensions,
      hitRules: [...hitRules, 'HX-07 危机线索立即转人工'],
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  if (!draft.consent.accepted || draft.consent.person === '未获得') {
    reviewReasons.push('未获得本人或代理人的检查授权')
    return {
      status: 'rejected',
      overallGrade: null,
      dimensions,
      hitRules: [...hitRules, 'D-00 未获知情同意不得形成等级建议'],
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  const transcriptNeedsConfirmation =
    draft.speechEvidence.rawText.trim().length > 0 && !draft.speechEvidence.confirmed
  if (!draft.fieldCheckDone || transcriptNeedsConfirmation) {
    reviewReasons.push('结构化字段尚未完成现场全量确认')
    return {
      status: 'rejected',
      overallGrade: null,
      dimensions,
      hitRules: [...hitRules, 'D-07 未经现场确认视同缺项'],
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  if (DIMENSION_ORDER.some((dimension) => dimensions[dimension].status === 'rejected')) {
    reviewReasons.push('至少一个维度缺项过多，无法形成总体建议')
    return {
      status: 'rejected',
      overallGrade: null,
      dimensions,
      hitRules,
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  if (DIMENSION_ORDER.some((dimension) => dimensions[dimension].status === 'manual')) {
    reviewReasons.push('至少一个维度有效任务不足，需要人工评定')
    return {
      status: 'manual',
      overallGrade: null,
      dimensions,
      hitRules,
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  const grades = DIMENSION_ORDER.map(
    (dimension) => dimensions[dimension].grade as Grade,
  )
  let overallGrade = Math.max(...grades) as Grade
  hitRules.push('B-1 总体取五维最高档')

  if (grades.filter((grade) => grade === 2).length >= 3) {
    overallGrade = 3
    hitRules.push('B-2 三个及以上2档升级为3档')
  }

  if (draft.conflictFlag) {
    return {
      status: 'rejected',
      overallGrade: null,
      dimensions,
      hitRules,
      missingItems,
      qualityAlerts,
      reviewReasons,
      ruleVersion: RULE_VERSION,
    }
  }

  return {
    status: 'graded',
    overallGrade,
    dimensions,
    hitRules,
    missingItems,
    qualityAlerts,
    reviewReasons,
    ruleVersion: RULE_VERSION,
  }
}
