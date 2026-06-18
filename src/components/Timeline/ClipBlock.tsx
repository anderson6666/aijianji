import React, { useState, useCallback, useRef } from 'react'
import type { Clip, Track } from '@/types'
import useProjectStore from '@/store/useProjectStore'

interface ClipBlockProps {
  clip: Clip
  track: Track
  isSelected: boolean
  pixelsPerSecond: number
  onSelect: () => void
  onUpdate: (updates: Partial<Clip>) => void
  onMove: (newTrackId: string, newStartTime: number) => void
  onDelete: () => void
}

// 拖拽状态类型
interface DragState {
  startX: number
  startTime: number
}

// 调整大小状态类型
interface ResizeState {
  startX: number
  startDuration: number
  startLeft: number
}

function ClipBlock({
  clip,
  track,
  isSelected,
  pixelsPerSecond,
  onSelect,
  onUpdate,
  onMove,
  onDelete,
}: ClipBlockProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)

  // 获取素材信息
  const material = useProjectStore((s) =>
    s.project.materials.find((m) => m.id === clip.materialId)
  )

  // 片段类型颜色映射
  const getTypeClass = (): string => {
    switch (track.type) {
      case 'video':
        return 'clip-video'
      case 'audio':
        return 'clip-audio'
      case 'effect':
        return 'clip-effect'
      default:
        return 'clip-video'
    }
  }

  // 格式化时长显示
  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s.toFixed(1)}s`
  }

  // 拖拽移动开始
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect()
      setIsDragging(true)
      dragRef.current = {
        startTime: clip.startTime,
        startX: e.clientX,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current) return
        const deltaX = moveEvent.clientX - dragRef.current.startX
        const deltaTime = deltaX / pixelsPerSecond
        const newStartTime = Math.max(0, dragRef.current.startTime + deltaTime)
        onUpdate({ startTime: newStartTime })
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        dragRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [clip.startTime, pixelsPerSecond, onSelect, onUpdate]
  )

  // 边缘调整时长
  const handleResizeStart = useCallback(
    (side: 'left' | 'right') => (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect()
      setIsResizing(side)
      resizeRef.current = {
        startX: e.clientX,
        startDuration: clip.duration,
        startLeft: clip.startTime,
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeRef.current) return
        const deltaX = moveEvent.clientX - resizeRef.current.startX
        const deltaSeconds = deltaX / pixelsPerSecond

        if (side === 'right') {
          const newDuration = Math.max(0.5, resizeRef.current.startDuration + deltaSeconds)
          onUpdate({ duration: newDuration })
        } else {
          const newStartTime = Math.max(0, resizeRef.current.startLeft + deltaSeconds)
          const durationReduction = newStartTime - resizeRef.current.startLeft
          const newDuration = Math.max(0.5, resizeRef.current.startDuration - durationReduction)
          onUpdate({
            startTime: newStartTime,
            duration: newDuration,
          })
        }
      }

      const handleMouseUp = () => {
        setIsResizing(null)
        resizeRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [clip.duration, clip.startTime, pixelsPerSecond, onSelect, onUpdate]
  )

  // 双击进入属性编辑
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect()
    },
    [onSelect]
  )

  // 删除快捷键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isSelected) {
          e.preventDefault()
          onDelete()
        }
      }
    },
    [isSelected, onDelete]
  )

  return (
    <div
      className={`clip-block ${getTypeClass()} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{
        left: clip.startTime * pixelsPerSecond,
        width: clip.duration * pixelsPerSecond,
      }}
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* 左边缘调整手柄 */}
      <div
        className="clip-handle clip-handle-left"
        onMouseDown={handleResizeStart('left')}
      />

      {/* 内容区 */}
      <div className="flex items-center h-full px-1.5 overflow-hidden gap-1">
        {/* 类型图标指示条 */}
        <div
          className="shrink-0 w-0.5 h-3 rounded-full self-center"
          style={{
            background:
              track.type === 'video'
                ? '#60a5fa'
                : track.type === 'audio'
                ? '#34d399'
                : '#c084fc',
          }}
        />
        {/* 名称和时长 */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-white/90 truncate leading-tight">
            {material?.name || `片段 ${clip.id.slice(0, 6)}`}
          </p>
          {(clip.duration * pixelsPerSecond > 60) && (
            <p className="text-[9px] text-white/50 font-mono leading-tight">
              {formatDuration(clip.duration)}
            </p>
          )}
        </div>
      </div>

      {/* 右边缘调整手柄 */}
      <div
        className="clip-handle clip-handle-right"
        onMouseDown={handleResizeStart('right')}
      />

      {/* 效果标记条：显示该片段上应用的效果 */}
      {clip.effects.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] flex gap-px overflow-hidden">
          {clip.effects.map((effect) => (
            <div
              key={effect.id}
              className="h-full bg-neon-purple/70 hover:bg-neon-purple transition-colors"
              style={{
                left: effect.startTime * pixelsPerSecond,
                width: effect.duration * pixelsPerSecond,
                position: 'relative',
              }}
              title={`${effect.type} (${effect.startTime.toFixed(1)}s - ${(effect.startTime + effect.duration).toFixed(1)}s)`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ClipBlock
