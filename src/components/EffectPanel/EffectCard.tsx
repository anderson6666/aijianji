import React from 'react'
import * as LucideIcons from 'lucide-react'
import { Zap } from 'lucide-react'
import type { EffectDefinition } from '@/types'
import EffectParamsEditor from './EffectParamsEditor'

interface EffectCardProps {
  definition: EffectDefinition
  expanded: boolean
  onToggleExpand: () => void
  onSelectForApply: () => void
}

function EffectCard({
  definition,
  expanded,
  onToggleExpand,
  onSelectForApply,
}: EffectCardProps) {
  // 动态获取图标组件
  const IconComponent = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number }> | undefined>)[definition.icon]

  return (
    <div
      className={`effect-card ${expanded ? 'selected' : ''}`}
      onClick={expanded ? undefined : onToggleExpand}
    >
      {/* 头部：图标 + 名称 + 分类标签 */}
      <div className="flex items-start gap-2.5">
        {/* 图标 */}
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{
            background:
              definition.category === 'transition'
                ? 'rgba(59,130,246,0.15)'
                : definition.category === 'visual'
                ? 'rgba(168,85,247,0.15)'
                : definition.category === 'color'
                ? 'rgba(236,72,153,0.15)'
                : definition.category === 'audio'
                ? 'rgba(16,185,129,0.15)'
                : definition.category === 'narrative'
                ? 'rgba(251,191,36,0.15)'
                : 'rgba(239,68,68,0.15)',
            color:
              definition.category === 'transition'
                ? '#60a5fa'
                : definition.category === 'visual'
                ? '#c084fc'
                : definition.category === 'color'
                ? '#f472b6'
                : definition.category === 'audio'
                ? '#34d399'
                : definition.category === 'narrative'
                ? '#fbbf24'
                : '#f87171',
          }}
        >
          {IconComponent ? <IconComponent size={18} /> : <span className="text-lg">✨</span>}
        </div>

        {/* 信息 */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-text-primary truncate">
            {definition.name}
          </h4>
          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2 leading-relaxed">
            {definition.description}
          </p>
          <span
            className="inline-block mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-muted)',
            }}
          >
            {definition.categoryName}
          </span>
        </div>
      </div>

      {/* 展开的参数面板 */}
      {expanded && definition.paramDefs.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <EffectParamsEditor
            paramDefs={definition.paramDefs}
            defaultParams={definition.defaultParams}
          />
        </div>
      )}

      {/* 无参数提示 */}
      {expanded && definition.paramDefs.length === 0 && (
        <div className="mt-2 text-center py-2">
          <p className="text-[11px] text-text-muted">此效果无需额外参数</p>
        </div>
      )}

      {/* 操作按钮区 */}
      <div className={`mt-2 flex gap-2 ${expanded ? '' : 'pt-2'}`} style={expanded ? { borderTop: '1px solid var(--border-color)' } : {}}>
        {!expanded && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelectForApply() }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ background: 'var(--accent-cyan)', color: '#fff' }}
          >
            <Zap size={12} />
            快速应用
          </button>
        )}
        {!expanded && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            查看参数
          </button>
        )}
      </div>
    </div>
  )
}

export default EffectCard
