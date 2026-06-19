import React, { useCallback, useState, useRef } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import { getEffectDefinition } from '@/data/effectDefinitions'

interface EffectTrackRowProps {
  height: number
  pixelsPerSecond: number
  totalDuration: number
}

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

  // 收集所有视频片段上的效果
  const effectBlocks: Array<{
    id: string
    clipId: string
    effectId: string
    type: string
    name: string
    left: number
    width: number
    absoluteTime: number
  }> = []

  for (const track of project.tracks) {
    if (track.type !== 'video') continue
    for (const clip of track.clips) {
      if (clip.effects.length === 0) continue
      for (const effect of clip.effects) {
        const definition = getEffectDefinition(effect.type)
        effectBlocks.push({
          id: `${clip.id}-${effect.id}`,
          clipId: clip.id,
          effectId: effect.id,
          type: effect.type,
          name: definition?.name ?? effect.type,
          left: (clip.startTime + effect.startTime) * pixelsPerSecond,
          width: effect.duration * pixelsPerSecond,
          absoluteTime: clip.startTime + effect.startTime,
        })
      }
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, clipId: string, effectId: string) => {
    e.preventDefault()
    e.stopPropagation()
    selectClip(clipId)
    selectEffect(effectId)
    setContextMenu({ x: e.clientX, y: e.clientY, clipId, effectId })
  }, [selectClip, selectEffect])

  const handleDelete = useCallback(() => {
    if (!contextMenu) return
    removeEffectFromClip(contextMenu.clipId, contextMenu.effectId)
    selectEffect(null)
    setContextMenu(null)
  }, [contextMenu, removeEffectFromClip, selectEffect])

  const handleMouseDown = useCallback((e: React.MouseEvent, block: typeof effectBlocks[0]) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    selectClip(block.clipId)
    selectEffect(block.effectId)

    const clip = project.tracks.flatMap(t => t.clips).find(c => c.id === block.clipId)
    if (!clip) return

    setDragging({
      clipId: block.clipId,
      effectId: block.effectId,
      originalStartTime: block.absoluteTime - clip.startTime,
      clipStartTime: clip.startTime,
      clipDuration: clip.duration,
      startX: e.clientX,
    })
  }, [project.tracks, selectClip, selectEffect])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const deltaTime = (e.clientX - dragging.startX) / pixelsPerSecond
    const newStartTime = Math.max(0, Math.min(dragging.originalStartTime + deltaTime, dragging.clipDuration - 0.1))
    updateEffectOnClip(dragging.clipId, dragging.effectId, { startTime: newStartTime })
  }, [dragging, pixelsPerSecond, updateEffectOnClip])

  const handleMouseUp = useCallback(() => setDragging(null), [])

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

  React.useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  return (
    <>
      <div className="relative border-b select-none" style={{ height, borderColor: 'var(--border-color)', background: 'rgba(88,28,135,0.08)' }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-text-muted/40 font-medium tracking-wider uppercase">Effects Track</span>
        </div>

        {effectBlocks.map((block) => {
          const isSelected = selectedClipId === block.clipId && selectedEffectId === block.effectId
          return (
            <div
              key={block.id}
              className={`absolute top-1 bottom-1 rounded cursor-grab flex items-center px-1.5 overflow-hidden transition-all hover:brightness-125 ${isSelected ? 'ring-2 ring-neon-purple shadow-lg shadow-neon-purple/30' : ''} ${dragging?.effectId === block.effectId ? 'cursor-grabbing opacity-80' : ''}`}
              style={{
                left: Math.max(0, block.left),
                width: Math.max(20, block.width),
                background: 'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(168,85,247,0.75))',
                border: '1px solid rgba(192,132,252,0.5)',
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, block)}
              onContextMenu={(e) => handleContextMenu(e, block.clipId, block.effectId)}
              title={`${block.name} (${block.absoluteTime.toFixed(1)}s)\n右键删除 · 拖拽移动`}
            >
              <Sparkles size={10} className="shrink-0 text-white/80" />
              <span className="ml-1 text-[10px] font-medium text-white/90 truncate leading-tight">{block.name}</span>
            </div>
          )
        })}
      </div>

      {contextMenu && (
        <div
          className="fixed z-[9999] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-hover)] text-red-400 transition-colors" onClick={handleDelete}>
            <Trash2 size={14} />
            <span>删除效果</span>
          </button>
        </div>
      )}
    </>
  )
}

export default EffectTrackRow
