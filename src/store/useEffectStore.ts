import { create } from 'zustand'
import type { EffectType, AppliedEffect, Keyframe } from '@/types'
import { getEffectDefinition } from '@/data/effectDefinitions'

interface EffectState {
  // 当前选中的效果（在效果面板中编辑）
  selectedEffectId: string | null
  selectedEffectClipId: string | null

  // 正在编辑的效果参数
  editingParams: Record<string, number | string | boolean>

  // 当前选中的关键帧索引
  selectedKeyframeIndex: number | null

  // 效果搜索/过滤
  searchQuery: string
  activeCategory: string | null

  // 预览状态
  previewingEffect: EffectType | null
  previewIntensity: number

  // Actions
  selectEffect: (effectId: string | null, clipId: string | null) => void
  setEditingParam: (key: string, value: number | string | boolean) => void
  resetEditingParams: () => void
  applyEditingParams: () => Record<string, number | string | boolean>

  setSelectedKeyframeIndex: (index: number | null) => void

  setSearchQuery: (query: string) => void
  setActiveCategory: (category: string | null) => void

  setPreviewEffect: (effectType: EffectType | null) => void
  setPreviewIntensity: (intensity: number) => void
  clearPreview: () => void

  // 关键帧操作
  addKeyframe: (effect: AppliedEffect, time: number, value: number) => AppliedEffect
  removeKeyframe: (effect: AppliedEffect, index: number) => AppliedEffect
  updateKeyframe: (effect: AppliedEffect, index: number, updates: Partial<Keyframe>) => AppliedEffect

  // 辅助方法
  getCurrentEffectDefinition: () => ReturnType<typeof getEffectDefinition>
  getFilteredEffects: (allEffects: { id: EffectType; name: string; category: string }[]) => typeof allEffects
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

const useEffectStore = create<EffectState>((set, get) => ({
  selectedEffectId: null,
  selectedEffectClipId: null,

  editingParams: {},
  selectedKeyframeIndex: null,

  searchQuery: '',
  activeCategory: null,

  previewingEffect: null,
  previewIntensity: 0.5,

  selectEffect: (effectId, clipId) => {
    const state = get()

    // 如果选中了效果，加载其参数到编辑器
    if (effectId && clipId) {
      // 从项目store中查找对应效果的当前参数
      // 这里通过回调方式获取，实际使用时需要引入useProjectStore
      set({
        selectedEffectId: effectId,
        selectedEffectClipId: clipId,
        editingParams: {},
        selectedKeyframeIndex: null,
      })
    } else {
      set({
        selectedEffectId: null,
        selectedEffectClipId: null,
        editingParams: {},
        selectedKeyframeIndex: null,
      })
    }
  },

  setEditingParam: (key, value) =>
    set((state) => ({
      editingParams: { ...state.editingParams, [key]: value },
    })),

  resetEditingParams: () => set({ editingParams: {} }),

  applyEditingParams: () => {
    const params = get().editingParams
    set({ editingParams: {} })
    return params
  },

  setSelectedKeyframeIndex: (index) => set({ selectedKeyframeIndex: index }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),

  setPreviewEffect: (effectType) => set({ previewingEffect: effectType }),
  setPreviewIntensity: (intensity) =>
    set({ previewIntensity: Math.max(0, Math.min(1, intensity)) }),

  clearPreview: () =>
    set({ previewingEffect: null, previewIntensity: 0.5 }),

  addKeyframe: (effect, time, value) => {
    const newKeyframe: Keyframe = { time, value, easing: 'easeInOut' }
    const keyframes = [...effect.keyframes, newKeyframe].sort(
      (a, b) => a.time - b.time
    )
    return { ...effect, keyframes }
  },

  removeKeyframe: (effect, index) => {
    const keyframes = effect.keyframes.filter((_, i) => i !== index)
    return { ...effect, keyframes }
  },

  updateKeyframe: (effect, index, updates) => {
    const keyframes = effect.keyframes.map((kf, i) =>
      i === index ? { ...kf, ...updates } : kf
    ).sort((a, b) => a.time - b.time)
    return { ...effect, keyframes }
  },

  getCurrentEffectDefinition: () => {
    const state = get()
    if (!state.selectedEffectId) return undefined
    return getEffectDefinition(state.selectedEffectId)
  },

  getFilteredEffects: (allEffects) => {
    const state = get()
    let filtered = allEffects

    // 按分类过滤
    if (state.activeCategory) {
      filtered = filtered.filter((e) => e.category === state.activeCategory)
    }

    // 按搜索词过滤
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.id.toLowerCase().includes(query)
      )
    }

    return filtered
  },
}))

export default useEffectStore
