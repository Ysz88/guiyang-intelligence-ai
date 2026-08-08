import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  EmptyState,
  EvaluationStatusBadge,
  GradeBadge,
  PageHeader,
  StatusBadge,
} from '../components/common'
import { DIMENSION_META, DIMENSION_ORDER } from '../data/taskDefinitions'
import type { AssessmentRecord, Resident } from '../types'

function reviewPriority(record: AssessmentRecord) {
  if (record.evaluation.status === 'crisis') return 0
  if (record.evaluation.status === 'rejected') return 1
  if (record.evaluation.status === 'manual') return 2
  if (record.evaluation.qualityAlerts.length > 0) return 3
  return 4
}

export function ReviewView({
  residents,
  records,
  onConfirm,
}: {
  residents: Resident[]
  records: AssessmentRecord[]
  onConfirm: (recordId: string, adjustmentReason?: string) => void
}) {
  const queue = useMemo(
    () => records
      .filter((record) => record.status !== '已确认')
      .sort((a, b) => reviewPriority(a) - reviewPriority(b)),
    [records],
  )
  const [selectedId, setSelectedId] = useState(queue[0]?.id ?? null)
  const [note, setNote] = useState('')
  const selected = queue.find((record) => record.id === selectedId) ?? queue[0] ?? null
  const resident = residents.find((item) => item.id === selected?.residentId) ?? null

  useEffect(() => {
    if (selectedId && queue.some((record) => record.id === selectedId)) return
    setSelectedId(queue[0]?.id ?? null)
  }, [queue, selectedId])

  useEffect(() => setNote(''), [selected?.id])

  const needsNote = selected ? selected.evaluation.status !== 'graded' : false
  const canConfirm = Boolean(selected && (!needsNote || note.trim().length >= 6))

  const confirm = () => {
    if (!selected || !canConfirm) return
    onConfirm(selected.id, note.trim())
  }

  return (
    <div className="view-stack review-page">
      <PageHeader
        title="人工复核"
        description="按危机、拒判、人工评定和质量提醒排序，保留规则命中与人员说明。"
      />

      {queue.length === 0 ? (
        <EmptyState>
          <CheckCircle2 size={28} aria-hidden="true" />
          <strong>当前没有待复核记录</strong>
          <span>所有模拟年度检查均已完成确认。</span>
        </EmptyState>
      ) : (
        <div className="review-layout">
          <aside className="review-queue panel panel-flush">
            <div className="queue-heading">
              <span>待处理队列</span>
              <strong>{queue.length}</strong>
            </div>
            <div className="queue-list">
              {queue.map((record) => {
                const itemResident = residents.find((item) => item.id === record.residentId)
                return (
                  <button
                    key={record.id}
                    type="button"
                    className={selected?.id === record.id ? 'active' : ''}
                    onClick={() => setSelectedId(record.id)}
                  >
                    <span className={`queue-risk risk-${record.evaluation.status}`} aria-hidden="true" />
                    <span>
                      <strong>{itemResident?.displayName ?? record.residentId}</strong>
                      <small>{itemResident?.room} · {record.checkDate}</small>
                    </span>
                    <EvaluationStatusBadge status={record.evaluation.status} />
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </aside>

          {selected && resident ? (
            <div className="review-detail">
              <section className="panel review-summary-panel">
                <div className="review-person-header">
                  <div>
                    <span className="section-kicker">{resident.archiveId}</span>
                    <h2>{resident.displayName}</h2>
                    <p>{resident.age}岁 · {resident.room} · {resident.languageBackground}</p>
                  </div>
                  <div className="review-badges">
                    <StatusBadge status={selected.status} />
                    <EvaluationStatusBadge status={selected.evaluation.status} />
                  </div>
                </div>

                <div className="review-grade-band">
                  <div><span>规则总体建议</span><GradeBadge grade={selected.evaluation.overallGrade} /></div>
                  <div><span>规则版本</span><strong>{selected.evaluation.ruleVersion}</strong></div>
                  <div><span>检查人员</span><strong>{selected.draft.inspectorId}</strong></div>
                  <div><span>输入方式</span><strong>{selected.draft.inputMode}</strong></div>
                </div>

                <div className="dimension-review-grid">
                  {DIMENSION_ORDER.map((dimension) => {
                    const result = selected.evaluation.dimensions[dimension]
                    return (
                      <div key={dimension}>
                        <span>{DIMENSION_META[dimension].label}</span>
                        <GradeBadge grade={result.grade} />
                        <small>{result.missingCount > 0 ? `缺 ${result.missingCount} 项` : `折算分 ${result.normalizedSum ?? '-'}`}</small>
                      </div>
                    )
                  })}
                </div>
              </section>

              <div className="review-content-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div><span className="section-kicker">需要判断</span><h2>复核原因与质量提醒</h2></div>
                    <FileWarning size={19} aria-hidden="true" />
                  </div>
                  <div className="review-reasons">
                    {selected.evaluation.reviewReasons.map((reason) => (
                      <div className="reason-critical" key={reason}><AlertTriangle size={16} aria-hidden="true" /><span>{reason}</span></div>
                    ))}
                    {selected.evaluation.qualityAlerts.map((alert) => (
                      <div className="reason-warning" key={alert}><FileWarning size={16} aria-hidden="true" /><span>{alert}</span></div>
                    ))}
                    {selected.evaluation.reviewReasons.length === 0 && selected.evaluation.qualityAlerts.length === 0 ? (
                      <div className="reason-ready"><Check size={16} aria-hidden="true" /><span>无异常规则命中，等待检查人员确认。</span></div>
                    ) : null}
                  </div>

                  <div className="rule-trace">
                    <h3>规则命中记录</h3>
                    <ul>
                      {selected.evaluation.hitRules.map((rule) => <li key={rule}>{rule}</li>)}
                    </ul>
                  </div>
                </section>

                <section className="panel evidence-review-panel">
                  <div className="section-heading">
                    <div><span className="section-kicker">证据核对</span><h2>结构化文本与现场确认</h2></div>
                    <ShieldCheck size={19} aria-hidden="true" />
                  </div>
                  <dl className="evidence-list">
                    <div><dt>ASR原文</dt><dd>{selected.draft.speechEvidence.rawText || '未使用语音识别'}</dd></div>
                    <div><dt>人工修正</dt><dd>{selected.draft.speechEvidence.correctedText || '未填写'}</dd></div>
                    <div><dt>语言背景</dt><dd>{selected.draft.speechEvidence.languageBackground}</dd></div>
                    <div><dt>文本已确认</dt><dd>{selected.draft.speechEvidence.confirmed ? '是' : '否'}</dd></div>
                    <div><dt>ASR置信度</dt><dd>{selected.draft.speechEvidence.asrConfidence ?? '未采集'}</dd></div>
                    <div><dt>姿态质量</dt><dd>{selected.draft.poseQuality ?? '人工观察/未采集'}</dd></div>
                    <div><dt>字段全量确认</dt><dd>{selected.draft.fieldCheckDone ? '是' : '否'}</dd></div>
                    <div><dt>原始音视频</dt><dd>未保存</dd></div>
                  </dl>
                </section>
              </div>

              <section className="panel confirm-panel">
                <div className="section-heading">
                  <div><span className="section-kicker">人员决定</span><h2>{selected.evaluation.status === 'graded' ? '确认规则建议' : '记录人工处置结论'}</h2></div>
                </div>
                <label>
                  复核说明{needsNote ? '（必填，至少6个字）' : '（可选）'}
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={needsNote ? '说明补测、现场判断或危机线索处置情况' : '可记录现场补充观察'}
                  />
                </label>
                <div className="confirm-actions">
                  <p>点击确认后将写入确认人员、时间和说明。演示版保存在当前浏览器本地。</p>
                  <button className="primary-button" type="button" onClick={confirm} disabled={!canConfirm}>
                    <ShieldCheck size={17} aria-hidden="true" />
                    {selected.evaluation.status === 'graded' ? '确认并归档' : '确认人工处置'}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
