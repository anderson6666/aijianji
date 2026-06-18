import React, { useState } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import PropertyPanel from '@/components/PropertyPanel/PropertyPanel'

function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const selectedClipId = useProjectStore((s) => s.selectedClipId)

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center py-3 shrink-0"
        style={{
          width: 44,
          background: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="btn-icon mb-2"
          title="展开面板"
        >
          <ChevronLeft size={16} />
        </button>
        {/* 选中指示 */}
        <button
          className="btn-icon"
          style={{
            width: 32,
            height: 32,
            color: selectedClipId ? 'var(--accent-cyan)' : 'var(--text-muted)',
            background: selectedClipId ? 'rgba(0,212,255,0.1)' : undefined,
          }}
          title={selectedClipId ? '已选中片段' : '未选中'}
        >
          <Info size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 300,
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-color)',
      }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          {selectedClipId ? '属性' : '项目信息'}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="btn-icon shrink-0"
          style={{ width: 26, height: 26 }}
          title="折叠面板"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {selectedClipId ? (
          <PropertyPanel />
        ) : (
          <ProjectInfo />
        )}
      </div>
    </div>
  )
}

// 无选中时显示项目信息
function ProjectInfo() {
  const project = useProjectStore((s) => s.project)

  const infoItems = [
    { label: '项目名称', value: project.name },
    {
      label: '分辨率',
      value: `${project.resolution.width} × ${project.resolution.height}`,
    },
    { label: '帧率', value: `${project.fps} FPS` },
    { label: '总时长', value: `${project.duration.toFixed(2)}s` },
    { label: '轨道数', value: String(project.tracks.length) },
    { label: '素材数', value: String(project.materials.length) },
    { label: '片段总数', value: String(project.tracks.reduce((sum, t) => sum + t.clips.length, 0)) },
  ]

  return (
    <div className="p-4 space-y-3">
      {infoItems.map((item) => (
        <div key={item.label} className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-text-muted uppercase tracking-wide">
            {item.label}
          </span>
          <span className="text-sm font-mono text-text-primary">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default RightSidebar
