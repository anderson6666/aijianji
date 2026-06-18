import React, { useState, useCallback } from 'react'
import { Search, Sparkles, AlertCircle } from 'lucide-react'
import useEffectStore from '@/store/useEffectStore'
import useProjectStore from '@/store/useProjectStore'
import { effectDefinitionsByCategory } from '@/data/effectDefinitions'
import type { EffectCategory, EffectDefinition } from '@/types'
import EffectCard from './EffectCard'

// 分类配置（仅保留视觉效果相关分类）
const CATEGORIES: { key: EffectCategory | null; label: string }[] = [
  { key: null, label: '全部' },
  { key: 'transition', label: '转场' },
  { key: 'visual', label: '画面特效' },
  { key: 'color', label: '色彩' },
]

function EffectPanel() {
  const [selectedDef, setSelectedDef] = useState<EffectDefinition | null>(null)
  const [applyStatus, setApplyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Store - 效果面板
  const searchQuery = useEffectStore((s) => s.searchQuery)
  const setSearchQuery = useEffectStore((s) => s.setSearchQuery)
  const activeCategory = useEffectStore((s) => s.activeCategory)
  const setActiveCategory = useEffectStore((s) => s.setActiveCategory)

  // Store - 项目（用于获取选中片段和应用效果）
  const selectedClipId = useProjectStore((s) => s.selectedClipId)
  const addEffectToClip = useProjectStore((s) => s.addEffectToClip)

  // 获取过滤后的效果列表
  const getFilteredEffects = (): EffectDefinition[] => {
    let effects: EffectDefinition[]

    if (activeCategory) {
      effects = effectDefinitionsByCategory[activeCategory] || []
    } else {
      effects = Object.values(effectDefinitionsByCategory).flat()
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      effects = effects.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q)
      )
    }

    return effects
  }

  const filteredEffects = getFilteredEffects()

  // 应用效果到选中片段
  const handleApplyEffect = useCallback(
    (def: EffectDefinition, params?: Record<string, number | string | boolean>) => {
      if (!selectedClipId) return

      try {
        const state = useProjectStore.getState()
        const playheadTime = state.currentTime ?? 0

        const clip = state.project.tracks
          .flatMap((t) => t.clips)
          .find((c) => c.id === selectedClipId)

        if (!clip) return

        const clipStartTime = clip.startTime
        // 效果起始时间 = 播放头位置 - 片段开始时间（相对于片段的内部时间）
        let effectStartTime = playheadTime - clipStartTime

        // 边界钳位：不允许负数，不允许超出片段末尾
        const clipEndTime = clipStartTime + clip.duration
        const defaultDuration = typeof def.defaultParams?.duration === 'number'
          ? Math.max(def.defaultParams.duration / 1000, 0.5)
          : 3
        effectStartTime = Math.max(0, Math.min(effectStartTime, clipEndTime - defaultDuration))

        addEffectToClip(selectedClipId, {
          type: def.id,
          params: params ?? { ...def.defaultParams },
          startTime: effectStartTime,
          duration: defaultDuration,
          keyframes: [],
        })
        setApplyStatus('success')
        setTimeout(() => setApplyStatus('idle'), 1500)
      } catch {
        setApplyStatus('error')
        setTimeout(() => setApplyStatus('idle'), 2000)
      }
    },
    [selectedClipId, addEffectToClip]
  )

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索效果..."
            className="input-dark w-full pl-8 pr-3 py-1.5 text-xs rounded-md"
          />
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-0.5 px-3 py-2 overflow-x-auto shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key ?? 'all'}
            onClick={() => setActiveCategory(cat.key)}
            className={`tab-item text-[11px] px-2.5 py-1 ${activeCategory === cat.key ? 'active' : ''}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 未选中片段提示 */}
      {!selectedClipId && (
        <div className="mx-3 mt-2 p-2 rounded-md flex items-center gap-2 text-xs" style={{
          background: 'rgba(255,51,102,0.08)',
          border: '1px solid rgba(255,51,102,0.2)',
          color: '#ff3366',
        }}>
          <AlertCircle size={13} className="shrink-0" />
          <span>请先在时间轴中选中一个片段</span>
        </div>
      )}

      {/* 应用成功提示 */}
      {applyStatus === 'success' && (
        <div className="mx-3 mt-2 p-2 rounded-md flex items-center gap-2 text-xs animate-fade-in" style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: '#34d399',
        }}>
          <Sparkles size={13} className="shrink-0" />
          <span>效果已应用到选中片段</span>
        </div>
      )}

      {/* 效果列表 / 参数编辑器 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedDef ? (
          /* 参数编辑 + 应用模式 */
          <div className="p-3 animate-fade-in">
            {/* 返回按钮 */}
            <button
              onClick={() => { setSelectedDef(null); setApplyStatus('idle') }}
              className="text-xs mb-3 cursor-pointer bg-transparent border-none px-0"
              style={{ color: 'var(--accent-cyan)' }}
            >
              &larr; 返回列表
            </button>

            <EffectCard
              definition={selectedDef}
              expanded
              onToggleExpand={() => {}}
              onSelectForApply={() => handleApplyEffect(selectedDef)}
            />

            {/* 应用按钮 */}
            <button
              onClick={() => handleApplyEffect(selectedDef)}
              disabled={!selectedClipId}
              className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-all btn-capsule justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              style={
                selectedClipId
                  ? { background: 'var(--accent-cyan)', color: '#fff' }
                  : { background: 'var(--bg-hover)', color: 'var(--text-muted)' }
              }
            >
              {selectedClipId ? '应用效果到选中片段' : '需要先选中片段'}
            </button>
          </div>
        ) : (
          /* 效果网格列表 */
          <div className="p-3 grid grid-cols-1 gap-2">
            {filteredEffects.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-text-muted">未找到匹配的效果</p>
              </div>
            ) : (
              filteredEffects.map((def) => (
                <EffectCard
                  key={def.id}
                  definition={def}
                  expanded={false}
                  onToggleExpand={() => { setSelectedDef(def); setApplyStatus('idle') }}
                  onSelectForApply={() => handleApplyEffect(def)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div
        className="px-3 py-2 text-[10px] text-text-muted text-center shrink-0"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        共 {filteredEffects.length} 个效果
        {selectedClipId && ' · 已选中片段'}
      </div>
    </div>
  )
}

export default EffectPanel
