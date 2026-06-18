import React, { useCallback, useState, useRef } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import { getEffectDefinition } from '@/data/effectDefinitions'

interface EffectTrackRowProps {
  height: number
  pixelsPerSecond: number
  totalDuration: number
}

/**
 * 效果轨道 - 聚合显示所有视频片段上应用的效果
 */
function EffectTrackRow({ height, pixelsPerSecond, totalDuration }: EffectTrackRowProps) {
  const project = useProjectStore((s) => s.project)
  const selectedClipId = useProjectStore((s) => s.selectedClipId)
  const selectedEffectId = useProjectStore((s) => s.selectedEffectId)
  const selectClip = useProjectStore((s) => s.selectClip)
  const selectEffect = useProjectStore((s) => s.selectEffect)
  const removeEffectFromClip = useProjectStore((s) => s.removeEffectFromClip)
  const updateEffectOnClip = useProjectStore((s) => s.updateEffectOnClip)

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    clipId: string
    effectId: string
  } | null>(null)

  // 拖拽状态
  const [dragging, setDragging] = useState<{
    clipId: string
    effectId: string
    originalStartTime: number
    clipStartTime: number
    clipDuration: number
    startX: number
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // 收集所有视频片段上的效果，映射为轨道上的效果块
  const effectBlocks: Array<{
    id: string
    clipId: string
    effectId: string
    type: string
    name: string
    left: number
    width: number
    absoluteTime: number // 效果在项目时间轴上的绝对起始时间
    relativeLeft: number // 相对于片段的左边距
  }> = []

  for (const track of project.tracks) {
    if (track.type !== 'video') continue

    for (const clip of track.clips) {
      if (clip.effects.length === 0) continue

      const clipAbsoluteStart = clip.startTime

      for (const effect of clip.effects) {
        const definition = getEffectDefinition(effect.type)
        effectBlocks.push({
          id: `${clip.id}-${effect.id}`,
          clipId: clip.id,
          effectId: effect.id,
          type: effect.type,
          name: definition?.name ?? effect.type,
          left: (clipAbsoluteStart + effect.startTime) * pixelsPerSecond,
          width: effect.duration * pixelsPerSecond,
          absoluteTime: clipAbsoluteStart + effect.startTime,
          relativeLeft: effect.startTime * pixelsPerSecond,
        })
      }
    }
  }

  // 处理右键点击
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId: string, effectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    selectClip(clipId)
    selectEffect(effectId)
    setContextMenu({ x: e.clientX, y: e.clientY, clipId, effectId })
  }, [selectClip, selectEffect])

  // 处理删除效果
  const handleDelete = useCallback(() => {
    if (!contextMenu) return
    removeEffectFromClip(contextMenu.clipId, contextMenu.effectId)
    selectEffect(null)
    setContextMenu(null)
  }, [contextMenu, removeEffectFromClip, selectEffect])

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // 处理拖拽开始
  const handleMouseDown = useCallback((e: React.MouseEvent, block: typeof effectBlocks[0]) => {
    if (e.button !== 0) return // 只响应左键
    e.preventDefault()
    e.stopPropagation()

    selectClip(block.clipId)
    selectEffect(block.effectId)

    // 找到对应的clip获取完整信息
    const clip = project.tracks
      .flatMap((t) => t.clips)
      .find((c) => c.id === block.clipId)

    if (!clip) return

    setDragging({
      clipId: block.clipId,
      effectId: block.effectId,
      originalStartTime: block.absoluteTime - clip.startTime, // 相对于clip的起始时间
      clipStartTime: clip.startTime,
      clipDuration: clip.duration,
      startX: e.clientX,
    })
  }, [project.tracks, selectClip, selectEffect])

  // 处理拖拽移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return

    const deltaX = e.clientX - dragging.startX
    const deltaTime = deltaX / pixelsPerSecond

    // 计算新的相对起始时间（保持在clip范围内）
    const newStartTime = Math.max(0, Math.min(
      dragging.originalStartTime + deltaTime,
      dragging.clipDuration - 0.1 // 至少保留0.1秒时长
    ))

    // 更新效果位置
    updateEffectOnClip(dragging.clipId, dragging.effectId, { startTime: newStartTime })
  }, [dragging, pixelsPerSecond, updateEffectOnClip])

  // 处理拖拽结束
  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // 添加全局鼠标事件监听
  React.useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // 点击空白处关闭菜单
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  return (
    <>
      <div
        ref={containerRef}
        className="relative border-b select-none"
        style={{
          height,
          borderColor: 'var(--border-color)',
          background: 'rgba(88,28,135,0.08)',
        }}
      >
        {/* 轨道标题提示 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-text-muted/40 font-medium tracking-wider uppercase">
            Effects Track
          </span>
        </div>

        {/* 效果块 */}
        {effectBlocks.map((block) => {
          const isBlockSelected =
            selectedClipId === block.clipId && selectedEffectId === block.effectId

          return (
            <div
              key={block.id}
              className={`absolute top-1 bottom-1 rounded cursor-grab flex items-center px-1.5 overflow-hidden transition-all hover:brightness-125 ${
                isBlockSelected ? 'ring-2 ring-neon-purple shadow-lg shadow-neon-purple/30' : ''
              } ${dragging?.effectId === block.effectId ? 'cursor-grabbing opacity-80' : ''}`}
              style={{
                left: Math.max(0, block.left),
                width: Math.max(20, block.width),
                background: 'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(168,85,247,0.75))',
                border: '1px solid rgba(192,132,252,0.5)',
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, block)}
              onContextMenu={(e) => handleContextMenu(e, block.clipId, block.effectId)}
              title={`${block.name} (${block.absoluteTime.toFixed(1)}s ~ ${(block.absoluteTime + block.width / pixelsPerSecond).toFixed(1)}s)\n右键删除 · 拖拽移动位置`}
            >
              {/* 效果图标 */}
              <Sparkles size={10} className="shrink-0 text-white/80" />

              {/* 效果名称 */}
              <span className="ml-1 text-[10px] font-medium text-white/90 truncate leading-tight">
                {block.name}
              </span>
            </div>
          )
        })}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-red-400 transition-colors"
            onClick={handleDelete}
          >
            <Trash2 size={14} />
            <span>删除效果</span>
          </button>
        </div>
      )}
    </>
  )
}

export default EffectTrackRow
