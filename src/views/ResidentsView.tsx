import { ClipboardCheck, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GradeBadge, PageHeader, StatusBadge } from '../components/common'
import type { RecordStatus, Resident } from '../types'

const FILTERS: Array<'全部' | RecordStatus> = ['全部', '待检查', '待复核', '已确认']

export function ResidentsView({
  residents,
  onStartAssessment,
}: {
  residents: Resident[]
  onStartAssessment: (residentId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部')

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return residents.filter((resident) => {
      const matchesStatus = filter === '全部' || resident.checkStatus === filter
      const matchesQuery =
        normalized.length === 0 ||
        `${resident.displayName}${resident.archiveId}${resident.room}`.toLowerCase().includes(normalized)
      return matchesStatus && matchesQuery
    })
  }, [filter, query, residents])

  return (
    <div className="view-stack">
      <PageHeader
        title="老人档案"
        description="当前养老院年度检查批次的模拟档案。"
        actions={
          <button className="primary-button" type="button" onClick={() => onStartAssessment(residents[0].id)}>
            <ClipboardCheck size={17} aria-hidden="true" />
            新建检查
          </button>
        }
      />

      <section className="toolbar-band">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索档案编号、房间"
          />
        </label>
        <div className="segmented-control" aria-label="状态筛选">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="toolbar-count">{filtered.length} 条</span>
      </section>

      <section className="panel panel-flush">
        <div className="table-scroll">
          <table className="data-table resident-table">
            <thead>
              <tr>
                <th>档案</th>
                <th>年龄</th>
                <th>房间</th>
                <th>语言使用背景</th>
                <th>主要照护需求</th>
                <th>上次结果</th>
                <th>检查状态</th>
                <th><span className="sr-only">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((resident) => (
                <tr key={resident.id}>
                  <td><strong>{resident.displayName}</strong><small>{resident.archiveId}</small></td>
                  <td>{resident.age}岁</td>
                  <td>{resident.room}</td>
                  <td>{resident.languageBackground}</td>
                  <td>{resident.mainNeed}</td>
                  <td><GradeBadge grade={resident.lastGrade} /></td>
                  <td><StatusBadge status={resident.checkStatus} /></td>
                  <td className="cell-action">
                    <button
                      className="icon-text-button"
                      type="button"
                      onClick={() => onStartAssessment(resident.id)}
                    >
                      <ClipboardCheck size={14} aria-hidden="true" />
                      {resident.checkStatus === '待检查' ? '开始' : '复查'}
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
