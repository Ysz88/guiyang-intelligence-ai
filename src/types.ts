export type DimensionKey =
  | 'mobility'
  | 'speech'
  | 'sensory'
  | 'psychology'
  | 'adl'

export type Grade = 0 | 1 | 2 | 3
export type TaskScore = Grade | null
export type LanguageBackground =
  | '普通话'
  | '地方口音普通话'
  | '方言或民族语言'
  | '未知或不愿填写'

export type InputMode =
  | 'AI视频语音对话'
  | '触屏自填'
  | '护理人员代录'
  | '历史结果导入'

export interface TaskDefinition {
  id: string
  dimension: DimensionKey
  label: string
  prompt: string
  levels: [string, string, string, string]
}

export interface SpeechEvidence {
  rawText: string
  correctedText: string
  confirmed: boolean
  asrConfidence: number | null
  languageBackground: LanguageBackground
  languageNote: string
}

export interface ConsentState {
  accepted: boolean
  person: '本人' | '代理人' | '未获得'
  allowAudio: boolean
  allowVideo: boolean
}

export interface AssessmentDraft {
  residentId: string
  inputMode: InputMode
  consent: ConsentState
  tasks: Record<DimensionKey, TaskScore[]>
  speechEvidence: SpeechEvidence
  poseQuality: number | null
  fieldCheckDone: boolean
  crisisFlag: boolean
  crisisNote: string
  conflictFlag: boolean
  inspectorId: string
}

export type EvaluationStatus = 'graded' | 'rejected' | 'manual' | 'crisis'

export interface DimensionResult {
  dimension: DimensionKey
  grade: Grade | null
  normalizedSum: number | null
  missingCount: number
  status: 'graded' | 'rejected' | 'manual'
  hitRules: string[]
}

export interface Evaluation {
  status: EvaluationStatus
  overallGrade: Grade | null
  dimensions: Record<DimensionKey, DimensionResult>
  hitRules: string[]
  missingItems: string[]
  qualityAlerts: string[]
  reviewReasons: string[]
  ruleVersion: string
}

export type RecordStatus = '待检查' | '待确认' | '待复核' | '已确认'

export interface Resident {
  id: string
  archiveId: string
  displayName: string
  age: number
  gender: '男' | '女'
  room: string
  floor: string
  languageBackground: LanguageBackground
  checkStatus: RecordStatus
  lastCheckDate: string | null
  lastGrade: Grade | null
  previousGrade: Grade | null
  mainNeed: string
  simulated: true
}

export interface AssessmentRecord {
  id: string
  residentId: string
  checkDate: string
  checkType: '年度检查'
  draft: AssessmentDraft
  evaluation: Evaluation
  status: RecordStatus
  confirmedAt: string | null
  confirmedBy: string | null
  adjustmentReason: string
  simulated: true
}

export interface DemoState {
  residents: Resident[]
  records: AssessmentRecord[]
  version: number
}
