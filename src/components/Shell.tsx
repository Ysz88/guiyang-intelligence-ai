import type { ComponentType, ReactNode } from 'react'
import {
  Building2,
  ClipboardCheck,
  FileText,
  Landmark,
  LayoutDashboard,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { DemoNotice } from './common'

export type ViewKey =
  | 'overview'
  | 'residents'
  | 'assessment'
  | 'reviews'
  | 'facility'
  | 'regulatory'

const NAV_ITEMS: Array<{
  key: ViewKey
  label: string
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
}> = [
  { key: 'overview', label: '总览', icon: LayoutDashboard },
  { key: 'residents', label: '老人档案', icon: Users },
  { key: 'assessment', label: '年度检查', icon: ClipboardCheck },
  { key: 'reviews', label: '人工复核', icon: ShieldAlert },
  { key: 'facility', label: '机构汇总', icon: Building2 },
  { key: 'regulatory', label: '监管摘要', icon: Landmark },
]

export function Shell({
  activeView,
  onNavigate,
  onReset,
  children,
}: {
  activeView: ViewKey
  onNavigate: (view: ViewKey) => void
  onReset: () => void
  children: ReactNode
}) {
  const activeLabel = NAV_ITEMS.find((item) => item.key === activeView)?.label ?? '总览'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => onNavigate('overview')}>
          <span className="brand-mark">桂</span>
          <span>
            <strong>桂养智检 AI</strong>
            <small>年度能力检查</small>
          </span>
        </button>

        <nav className="side-nav" aria-label="主要导航">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                className={activeView === item.key ? 'active' : ''}
                onClick={() => onNavigate(item.key)}
              >
                <Icon size={18} aria-hidden={true} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="responsibility-rule">
            <FileText size={16} aria-hidden="true" />
            <p>AI只整理，规则只判定，人员最终确认。</p>
          </div>
          <button className="secondary-button sidebar-reset" type="button" onClick={onReset}>
            <RotateCcw size={16} aria-hidden="true" />
            重置演示数据
          </button>
        </div>
      </aside>

      <div className="workspace">
        <div className="topbar">
          <div>
            <span className="topbar-context">桂康演示院 · 2026年度检查批次</span>
            <strong>{activeLabel}</strong>
          </div>
          <DemoNotice />
        </div>
        <main className="main-content">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              className={activeView === item.key ? 'active' : ''}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
            >
              <Icon size={19} aria-hidden={true} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
