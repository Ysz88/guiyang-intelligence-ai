import { Check, Copy, Download, LockKeyhole } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ComplianceNote, PageHeader, StatBlock } from '../components/common'
import type { AssessmentRecord, Resident } from '../types'

export function RegulatoryView({
  residents,
  records,
}: {
  residents: Resident[]
  records: AssessmentRecord[]
}) {
  const [copied, setCopied] = useState(false)
  const summary = useMemo(() => {
    const confirmed = records.filter((record) => record.status === '已确认')
    return {
      contract_version: 'GYZJ-REG-20260808-01',
      data_status: '模拟数据，仅用于功能演示',
      facility_id: 'SIM-ORG-GX-001',
      facility_name: '桂康演示院',
      period: '2026-annual',
      residents_total: residents.length,
      checks_confirmed: confirmed.length,
      checks_pending_review: records.filter((record) => record.status === '待复核').length,
      crisis_clues: records.filter((record) => record.evaluation.status === 'crisis').length,
      attention_distribution: [0, 1, 2, 3].map((grade) => ({
        grade,
        count: confirmed.filter((record) => record.evaluation.overallGrade === grade).length,
      })),
      excluded_fields: [
        '老人显示名',
        '联系方式',
        '语言使用背景',
        'ASR原文与修正文',
        '五维任务明细',
        '原始音视频',
      ],
      integration_status: '预留数据契约，未实际对接',
    }
  }, [records, residents.length])

  const text = JSON.stringify(summary, null, 2)

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }
  }

  const downloadSummary = () => {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'guiyang-regulatory-summary-demo.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view-stack">
      <PageHeader
        title="监管摘要"
        description="从机构年度检查结果生成的脱敏聚合数据。"
        actions={
          <div className="button-group">
            <button className="secondary-button" type="button" onClick={copySummary}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied ? '已复制' : '复制契约'}
            </button>
            <button className="primary-button" type="button" onClick={downloadSummary}>
              <Download size={16} aria-hidden="true" />
              导出摘要
            </button>
          </div>
        }
      />

      <ComplianceNote>预留标准化数据交换能力，未声称与任何政府平台完成实际对接。</ComplianceNote>

      <section className="stats-grid">
        <StatBlock label="在册档案计数" value={summary.residents_total} note="无姓名上行" tone="blue" />
        <StatBlock label="已确认检查" value={summary.checks_confirmed} note="规则版本可追溯" tone="green" />
        <StatBlock label="待复核事项" value={summary.checks_pending_review} note="仅状态与计数" tone="amber" />
        <StatBlock label="危机线索计数" value={summary.crisis_clues} note="明细留机构端" tone="red" />
      </section>

      <div className="regulatory-grid">
        <section className="panel code-panel">
          <div className="section-heading">
            <div><span className="section-kicker">数据契约</span><h2>机构级脱敏摘要</h2></div>
          </div>
          <pre><code>{text}</code></pre>
        </section>

        <section className="panel privacy-panel">
          <div className="section-heading">
            <div><span className="section-kicker">最小必要</span><h2>不上行字段</h2></div>
            <LockKeyhole size={20} aria-hidden="true" />
          </div>
          <ul className="exclusion-list">
            {summary.excluded_fields.map((item) => (
              <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <div className="contract-meta">
            <span>契约版本</span><strong>{summary.contract_version}</strong>
            <span>对接状态</span><strong>{summary.integration_status}</strong>
          </div>
        </section>
      </div>
    </div>
  )
}
