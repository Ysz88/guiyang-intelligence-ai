import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  ShieldAlert,
  Users,
} from 'lucide-react'
import type { ViewKey } from '../components/Shell'
import {
  GradeBadge,
  PageHeader,
  ProgressBar,
  StatBlock,
  StatusBadge,
} from '../components/common'
import type { AssessmentRecord, Resident } from '../types'

export function OverviewView({
  residents,
  records,
  onNavigate,
  onStartAssessment,
}: {
  residents: Resident[]
  records: AssessmentRecord[]
  onNavigate: (view: ViewKey) => void
  onStartAssessment: (residentId?: string) => void
}) {
  const confirmed = residents.filter((resident) => resident.checkStatus === '已确认').length
  const pending = residents.filter((resident) => resident.checkStatus === '待检查').length
  const reviews = residents.filter((resident) => resident.checkStatus === '待复核').length
  const crisis = records.filter((record) => record.evaluation.status === 'crisis').length
  const completionRate = Math.round((confirmed / residents.length) * 100)
  const gradeCounts = [0, 1, 2, 3].map(
    (grade) => residents.filter((resident) => resident.lastGrade === grade).length,
  )
  const queue = residents
    .filter((resident) => resident.checkStatus !== '已确认')
    .sort((a, b) => (a.checkStatus === '待复核' ? -1 : b.checkStatus === '待复核' ? 1 : 0))
    .slice(0, 6)

  return (
    <div className="view-stack">
      <PageHeader
        title="年度检查总览"
        description="当前批次的完成进度、关注分布和人工任务。"
        actions={
          <button className="primary-button" type="button" onClick={() => onStartAssessment()}>
            <ClipboardCheck size={17} aria-hidden="true" />
            开始年度检查
          </button>
        }
      />

      <section className="stats-grid" aria-label="批次摘要">
        <StatBlock label="在册模拟档案" value={residents.length} note="本批次" tone="blue" />
        <StatBlock label="已确认" value={confirmed} note={`${completionRate}% 完成`} tone="green" />
        <StatBlock label="待人工复核" value={reviews} note="按风险排序" tone="amber" />
        <StatBlock label="危机线索" value={crisis} note="流程已转人工" tone="red" />
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-wide">
          <div className="section-heading">
            <div>
              <span className="section-kicker">批次进度</span>
              <h2>年度检查完成情况</h2>
            </div>
            <strong className="large-inline-value">{completionRate}%</strong>
          </div>
          <ProgressBar value={completionRate} tone="green" />
          <div className="progress-breakdown">
            <span><i className="dot dot-green" />已确认 {confirmed}</span>
            <span><i className="dot dot-amber" />待复核 {reviews}</span>
            <span><i className="dot dot-neutral" />待检查 {pending}</span>
          </div>

          <div className="distribution-row" aria-label="关注等级分布">
            {gradeCounts.map((count, grade) => {
              const totalGraded = gradeCounts.reduce((sum, value) => sum + value, 0) || 1
              return (
                <div key={grade} className="distribution-item">
                  <div className="distribution-label">
                    <GradeBadge grade={grade as 0 | 1 | 2 | 3} />
                    <strong>{count}人</strong>
                  </div>
                  <ProgressBar value={(count / totalGraded) * 100} tone={`grade-${grade}`} />
                </div>
              )
            })}
          </div>
        </section>

        <section className="panel workflow-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">责任分层</span>
              <h2>结论如何形成</h2>
            </div>
          </div>
          <div className="responsibility-list">
            <div className="responsibility-item responsibility-ai">
              <Users size={18} aria-hidden="true" />
              <div><strong>AI只整理</strong><span>转写、关键点、字段化和冲突提示</span></div>
            </div>
            <div className="responsibility-item responsibility-rule">
              <Building2 size={18} aria-hidden="true" />
              <div><strong>规则只判定</strong><span>固定规则、版本可回放、缺项拒判</span></div>
            </div>
            <div className="responsibility-item responsibility-human">
              <ShieldAlert size={18} aria-hidden="true" />
              <div><strong>人员最终确认</strong><span>调整必须记录原因并进入审计留痕</span></div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="section-kicker">工作队列</span>
            <h2>需要处理的档案</h2>
          </div>
          <button className="text-button" type="button" onClick={() => onNavigate('reviews')}>
            查看复核队列 <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>档案</th>
                <th>房间</th>
                <th>语言使用背景</th>
                <th>状态</th>
                <th>上次关注</th>
                <th><span className="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((resident) => (
                <tr key={resident.id}>
                  <td><strong>{resident.displayName}</strong><small>{resident.archiveId}</small></td>
                  <td>{resident.room}</td>
                  <td>{resident.languageBackground}</td>
                  <td><StatusBadge status={resident.checkStatus} /></td>
                  <td><GradeBadge grade={resident.lastGrade} /></td>
                  <td className="cell-action">
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() =>
                        resident.checkStatus === '待复核'
                          ? onNavigate('reviews')
                          : onStartAssessment(resident.id)
                      }
                    >
                      {resident.checkStatus === '待复核' ? '复核' : '检查'}
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
