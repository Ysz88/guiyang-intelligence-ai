import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Info, ShieldCheck } from 'lucide-react'
import { GRADE_LABELS } from '../data/taskDefinitions'
import type { EvaluationStatus, Grade, RecordStatus } from '../types'

export function DemoNotice() {
  return (
    <div className="demo-notice" role="status">
      <Info size={15} aria-hidden="true" />
      <span>模拟数据，仅用于功能演示</span>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function GradeBadge({ grade }: { grade: Grade | null }) {
  if (grade === null) return <span className="badge badge-neutral">未形成建议</span>
  return <span className={`badge grade-${grade}`}>{GRADE_LABELS[grade]}</span>
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  const icon =
    status === '已确认' ? (
      <CheckCircle2 size={13} aria-hidden="true" />
    ) : status === '待复核' ? (
      <AlertTriangle size={13} aria-hidden="true" />
    ) : (
      <Clock3 size={13} aria-hidden="true" />
    )
  return (
    <span className={`badge status-${status}`}>
      {icon}
      {status}
    </span>
  )
}

export function EvaluationStatusBadge({ status }: { status: EvaluationStatus }) {
  const labels: Record<EvaluationStatus, string> = {
    graded: '规则已计算',
    rejected: '拒判待复核',
    manual: '转人工评定',
    crisis: '危机线索转人工',
  }
  return <span className={`badge evaluation-${status}`}>{labels[status]}</span>
}

export function StatBlock({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  note?: string
  tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red'
}) {
  return (
    <div className={`stat-block stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  )
}

export function ProgressBar({ value, tone = 'green' }: { value: number; tone?: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="progress" aria-label={`${safeValue}%`}>
      <span className={`progress-fill progress-${tone}`} style={{ width: `${safeValue}%` }} />
    </div>
  )
}

export function ComplianceNote({ children }: { children: ReactNode }) {
  return (
    <div className="compliance-note">
      <ShieldCheck size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}
