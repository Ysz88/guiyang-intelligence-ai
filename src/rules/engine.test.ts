import { describe, expect, it } from 'vitest'
import type { AssessmentDraft } from '../types'
import { evaluateAssessment } from './engine'

const baseDraft = (): AssessmentDraft => ({
  residentId: 'SIM-001',
  inputMode: 'AI视频语音对话',
  consent: {
    accepted: true,
    person: '本人',
    allowAudio: true,
    allowVideo: true,
  },
  tasks: {
    mobility: [1, 0, 1, 2, 0],
    speech: [0, 1, 0],
    sensory: [1, 1, 0],
    psychology: [0, 1, 1, 0, 0],
    adl: [2, 1, 1, 1, 0],
  },
  speechEvidence: {
    rawText: '今天早上我自己去吃饭',
    correctedText: '今天早上我自己去吃饭',
    confirmed: true,
    asrConfidence: 0.92,
    languageBackground: '普通话',
    languageNote: '',
  },
  poseQuality: 0.91,
  fieldCheckDone: true,
  crisisFlag: false,
  crisisNote: '',
  conflictFlag: false,
  inspectorId: 'INS-DEMO-01',
})

describe('deterministic rule engine', () => {
  it('matches the reference hand-calculation case', () => {
    const result = evaluateAssessment(baseDraft())

    expect(result.status).toBe('graded')
    expect(result.overallGrade).toBe(1)
    expect(result.dimensions.mobility.grade).toBe(1)
    expect(result.dimensions.speech.grade).toBe(0)
    expect(result.dimensions.sensory.grade).toBe(1)
  })

  it('rejects a dimension with too many missing tasks', () => {
    const draft = baseDraft()
    draft.tasks.mobility = [1, null, null, 1, 0]
    const result = evaluateAssessment(draft)

    expect(result.status).toBe('rejected')
    expect(result.overallGrade).toBeNull()
    expect(result.hitRules.join(' ')).toContain('D-01')
  })

  it('stops scoring when a crisis clue is confirmed', () => {
    const draft = baseDraft()
    draft.crisisFlag = true
    draft.crisisNote = '模拟危机线索'
    const result = evaluateAssessment(draft)

    expect(result.status).toBe('crisis')
    expect(result.overallGrade).toBeNull()
    expect(result.hitRules.join(' ')).toContain('HX-07')
  })

  it('does not let language background or ASR confidence alter grades', () => {
    const baseline = evaluateAssessment(baseDraft())
    const changed = baseDraft()
    changed.speechEvidence.languageBackground = '方言或民族语言'
    changed.speechEvidence.languageNote = '壮语夹杂'
    changed.speechEvidence.asrConfidence = 0.41
    const changedResult = evaluateAssessment(changed)

    expect(changedResult.overallGrade).toBe(baseline.overallGrade)
    expect(changedResult.dimensions).toEqual(baseline.dimensions)
    expect(changedResult.qualityAlerts.length).toBeGreaterThan(0)
  })

  it('requires human confirmation before scoring', () => {
    const draft = baseDraft()
    draft.fieldCheckDone = false
    const result = evaluateAssessment(draft)

    expect(result.status).toBe('rejected')
    expect(result.hitRules.join(' ')).toContain('D-07')
  })

  it('rejects grading when informed consent is missing', () => {
    const draft = baseDraft()
    draft.consent.accepted = false
    draft.consent.person = '未获得'
    const result = evaluateAssessment(draft)

    expect(result.status).toBe('rejected')
    expect(result.overallGrade).toBeNull()
    expect(result.hitRules).toContain('D-00 未获知情同意不得形成等级建议')
  })
})
