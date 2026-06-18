import React, { useState } from 'react'
import {
  FolderOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import MaterialLibrary from '@/components/MaterialLibrary/MaterialLibrary'
import EffectPanel from '@/components/EffectPanel/EffectPanel'

type TabType = 'materials' | 'effects'

function LeftSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('materials')
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 shrink-0"
        style={{
          width: 44,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="btn-icon mb-2"
          title="展开面板"
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex flex-col gap-2">
          <TabIcon
            icon={<FolderOpen size={18} />}
            active={activeTab === 'materials'}
            onClick={() => {
              setActiveTab('materials')
              setCollapsed(false)
            }}
            title="素材库"
          />
          <TabIcon
            icon={<Sparkles size={18} />}
            active={activeTab === 'effects'}
            onClick={() => {
              setActiveTab('effects')
              setCollapsed(false)
            }}
            title="效果面板"
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 280,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        {/* 标签页切换 */}
        <div className="tab-list">
          <button
            className={`tab-item ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen size={12} />
              素材库
            </span>
          </button>
          <button
            className={`tab-item ${activeTab === 'effects' ? 'active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} />
              效果
            </span>
          </button>
        </div>

        {/* 折叠按钮 */}
        <button
          onClick={() => setCollapsed(true)}
          className="btn-icon ml-2 shrink-0"
          style={{ width: 26, height: 26 }}
          title="折叠面板"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'materials' ? (
          <MaterialLibrary />
        ) : (
          <EffectPanel />
        )}
      </div>
    </div>
  )
}

// 折叠状态下的图标标签
function TabIcon({
  icon,
  active,
  onClick,
  title,
}: {
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="btn-icon"
      style={{
        width: 32,
        height: 32,
        color: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
        background: active ? 'rgba(0,212,255,0.1)' : undefined,
      }}
    >
      {icon}
    </button>
  )
}

export default LeftSidebar
