import React, { useState } from 'react'
import { Sparkles, Check } from 'lucide-react'
import Dialog from './Dialog'
import type { EffectDefinition } from '@/types'
import EffectParamsEditor from '@/components/EffectPanel/EffectParamsEditor'
import useProjectStore from '@/store/useProjectStore'

interface EffectApplyDialogProps {
  open: boolean
  onClose: () => void
  definition: EffectDefinition | null
}

// 需要自动放置到片段开头的效果类型
const EFFECTS_ANCHOR_START = new Set(['fadeIn', 'flashWhite', 'hardCut', 'dissolve'])
// 需要自动放置到片段末尾的效果类型
const EFFECTS_ANCHOR_END = new Set(['fadeOut', 'flashBlack', 'emptyShot'])

function EffectApplyDialog({ open, onClose, definition }: EffectApplyDialogProps) {
  const selectedClipId = useProjectStore((s) => s.selectedClipId)
  const addEffectToClip = useProjectStore((s) => s.addEffectToClip)
  // 订阅 currentTime 确保始终获取最新播放头位置（响应式更新）
  const currentTime = useProjectStore((s) => s.currentTime)

  // 用户通过 EffectParamsEditor 编辑后的参数（替代原始 defaultParams）
  const [editedParams, setEditedParams] = useState<Record<string, number | string | boolean>>({})

  if (!definition || !selectedClipId) return null

  // 计算效果默认持续时间（秒）
  // 优先使用效果定义中的 duration 参数（毫秒转秒），否则使用片段剩余时长或默认3秒
  const getDefaultDuration = (): number => {
    // 优先使用用户编辑后的 params.duration，其次用定义中的默认值
    const paramDuration = editedParams.duration ?? definition.defaultParams.duration
    if (typeof paramDuration === 'number' && paramDuration > 0) {
      return Math.max(paramDuration / 1000, 0.5)
    }
    // 没有duration参数的效果，给一个合理的默认值
    return 3
  }

  const handleApply = () => {
    const state = useProjectStore.getState()
    // 使用 ?? 避免 0 被 || 当作 falsy 走 fallback
    const playheadTime = state.currentTime ?? currentTime

    const clip = state.project.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === selectedClipId)

    if (!clip) {
      console.warn('[EffectApply] 未找到选中的片段:', selectedClipId)
      return
    }

    const clipStartTime = clip.startTime
    const effectDuration = getDefaultDuration()

    // ===== 效果起始时间计算 =====
    // 对于 fadeIn 等开场转场，自动锚定到片段开头；对于 fadeOut 等结尾转场，锚定到片段末尾
    // 其他效果跟随播放头位置
    let effectStartTime: number
    if (EFFECTS_ANCHOR_START.has(definition.id)) {
      // 开场效果：从片段最开始开始
      effectStartTime = 0
    } else if (EFFECTS_ANCHOR_END.has(definition.id)) {
      // 结尾效果：贴着片段末尾往前放
      effectStartTime = Math.max(0, clip.duration - effectDuration)
    } else {
      // 普通效果：跟随播放头位置
      effectStartTime = playheadTime - clipStartTime
    }

    // 仅做合理的边界钳位：不允许负数，不允许超出片段末尾
    const clipEndTime = clipStartTime + clip.duration
    effectStartTime = Math.max(0, Math.min(effectStartTime, clipEndTime - effectDuration))

    console.log('[EffectApply] 效果应用详情:', {
      effectType: definition.id,
      clipId: selectedClipId,
      clipStart: clipStartTime.toFixed(3) + 's',
      playhead: playheadTime.toFixed(3) + 's',
      reactiveCurrentTime: currentTime.toFixed(3) + 's',
      effectStart: effectStartTime.toFixed(3) + 's',
      duration: effectDuration.toFixed(3) + 's',
      absolutePosition: (clipStartTime + effectStartTime).toFixed(3) + 's',
      editedParams,
    })

    addEffectToClip(selectedClipId, {
      type: definition.id,
      // 使用用户编辑后的参数（如有），否则 fallback 到定义的默认参数
      params: Object.keys(editedParams).length > 0 ? { ...editedParams } : { ...definition.defaultParams },
      keyframes: [],
      startTime: effectStartTime,
      duration: effectDuration,
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`应用效果：${definition.name}`}
      width="500px"
    >
      <div className="space-y-4">
        {/* 效果信息 */}
        <div
          className="flex items-start gap-3 p-3 rounded-lg"
          style={{ background: 'var(--bg-surface)' }}
        >
          <Sparkles size={22} className="text-neon-purple shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              {definition.name}
            </h4>
            <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">
              {definition.description}
            </p>
            <span
              className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: 'rgba(168,85,247,0.15)',
                color: '#c084fc',
              }}
            >
              {definition.categoryName}
            </span>
          </div>
        </div>

        {/* 参数编辑器 */}
        {definition.paramDefs.length > 0 && (
          <div>
            <p className="panel-title">参数设置</p>
            <EffectParamsEditor
              paramDefs={definition.paramDefs}
              defaultParams={definition.defaultParams}
              onParamsChange={setEditedParams}
            />
          </div>
        )}

        {definition.paramDefs.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted">
              此效果无需配置参数，将使用默认设置应用。
            </p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button onClick={onClose} className="btn-capsule btn-ghost py-2">
            取消
          </button>
          <button
            onClick={handleApply}
            className="btn-capsule btn-primary py-2 gap-2"
          >
            <Check size={14} />
            应用到选中片段
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export default EffectApplyDialog
