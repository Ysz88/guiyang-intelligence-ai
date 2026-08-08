import { Download } from 'lucide-react'
import { DIMENSION_META, DIMENSION_ORDER } from '../data/taskDefinitions'
import { PageHeader, ProgressBar, StatBlock } from '../components/common'
import type { AssessmentRecord, Resident } from '../types'

function downloadJson(value: unknown, name: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function FacilityView({
  residents,
  records,
}: {
  residents: Resident[]
  records: AssessmentRecord[]
}) {
  const confirmed = residents.filter((resident) => resident.checkStatus === '已确认').length
  const reviewCount = residents.filter((resident) => resident.checkStatus === '待复核').length
  const completionRate = Math.round((confirmed / residents.length) * 100)
  const previousAverage =
    residents.reduce((sum, resident) => sum + (resident.previousGrade ?? 0), 0) / residents.length
  const currentGraded = residents.filter((resident) => resident.lastGrade !== null)
  const currentAverage =
    currentGraded.reduce((sum, resident) => sum + (resident.lastGrade ?? 0), 0) /
    Math.max(1, currentGraded.length)

  const dimensionNeeds = DIMENSION_ORDER.map((dimension) => {
    const graded = records
      .map((record) => record.evaluation.dimensions[dimension].grade)
      .filter((grade): grade is 0 | 1 | 2 | 3 => grade !== null)
    const attention = graded.filter((grade) => grade >= 2).length
    return {
      dimension,
      label: DIMENSION_META[dimension].label,
      attention,
      rate: Math.round((attention / Math.max(1, graded.length)) * 100),
    }
  }).sort((a, b) => b.attention - a.attention)

  const floorStats = ['2层', '3层', '4层'].map((floor) => {
    const people = residents.filter((resident) => resident.floor === floor)
    const done = people.filter((resident) => resident.checkStatus === '已确认').length
    return { floor, total: people.length, done, rate: Math.round((done / people.length) * 100) }
  })

  return (
    <div className="view-stack">
      <PageHeader
        title="机构汇总"
        description="用于年度检查组织、照护资源安排和历史对比。"
        actions={
          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              downloadJson({ facility: '桂康演示院', residents, records }, 'guiyang-facility-demo.json')
            }
          >
            <Download size={16} aria-hidden="true" />
            导出机构数据
          </button>
        }
      />

      <section className="stats-grid">
        <StatBlock label="检查完成率" value={`${completionRate}%`} note={`${confirmed}/${residents.length} 已确认`} tone="green" />
        <StatBlock label="待复核" value={reviewCount} note="含质量提醒与缺项" tone="amber" />
        <StatBlock label="本年度平均关注档" value={currentAverage.toFixed(2)} note="仅演示聚合" tone="blue" />
        <StatBlock label="上年度平均关注档" value={previousAverage.toFixed(2)} note="用于年度对比" tone="neutral" />
      </section>

      <div className="dashboard-grid equal-grid">
        <section className="panel">
          <div className="section-heading"><div><span className="section-kicker">资源安排</span><h2>主要能力支持需求</h2></div></div>
          <div className="rank-list">
            {dimensionNeeds.map((item) => (
              <div key={item.dimension} className="rank-item">
                <div><strong>{item.label}</strong><span>{item.attention}人达到需要协助或重点复核</span></div>
                <div className="rank-value">{item.rate}%</div>
                <ProgressBar value={item.rate} tone="amber" />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading"><div><span className="section-kicker">执行进度</span><h2>楼层完成情况</h2></div></div>
          <div className="rank-list">
            {floorStats.map((item) => (
              <div key={item.floor} className="rank-item">
                <div><strong>{item.floor}</strong><span>{item.done}/{item.total} 已确认</span></div>
                <div className="rank-value">{item.rate}%</div>
                <ProgressBar value={item.rate} tone="blue" />
              </div>
            ))}
          </div>
          <div className="comparison-band">
            <span>年度平均关注档变化</span>
            <strong className={currentAverage <= previousAverage ? 'text-green' : 'text-amber'}>
              {currentAverage <= previousAverage ? '较上年度稳定或改善' : '较上年度需增加关注'}
            </strong>
          </div>
        </section>
      </div>
    </div>
  )
}
