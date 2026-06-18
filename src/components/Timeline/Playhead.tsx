import React, { useCallback, useState, useRef, useEffect } from 'react'
import Tooltip from '@/components/Common/Tooltip'

interface PlayheadProps {
  currentTime: number
  pixelsPerSecond: number
  totalTracks: number
  trackHeight: number
  rulerHeight: number
}

function Playhead({
  currentTime,
  pixelsPerSecond,
  totalTracks,
  trackHeight,
  rulerHeight,
}: PlayheadProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const position = currentTime * pixelsPerSecond

  // 格式化时间
  const formatTime = (t: number): string => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const f = Math.floor((t % 1) * 30)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
  }

  // 拖拽播放头
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const container = containerRef.current?.parentElement
      if (!container) return

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        const x = moveEvent.clientX - rect.left + container.scrollLeft
        const time = Math.max(0, x / pixelsPerSecond)

        // 更新 store 中的当前时间
        useProjectStore.getState().setCurrentTime(time)

        tooltipPos.current = { x: moveEvent.clientX, y: moveEvent.clientY }
        setShowTooltip(true)
      }

      const handleMouseUp = () => {
        setShowTooltip(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [pixelsPerSecond]
  )

  return (
    <>
      <div
        ref={containerRef}
        className="playhead playhandle-draggable"
        style={{
          left: position,
          top: 0,
          height: rulerHeight + totalTracks * trackHeight,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 三角形指针 */}
        <div className="playhead-head" />

        {/* 垂直线 */}
        <div
          className="playhead-line"
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1,
            height: 'calc(100% - 8px)',
            background: 'linear-gradient(to bottom, #ef4444, rgba(239,68,68,0.6))',
          }}
        />
      </div>

      {/* 拖拽时的时间提示 */}
      {showTooltip && (
        <div
          className="fixed z-[9999] px-2 py-1 text-xs font-mono rounded animate-fade-in pointer-events-none"
          style={{
            left: tooltipPos.current.x + 10,
            top: tooltipPos.current.y - 30,
            background: 'var(--bg-card)',
            border: '1px solid #ef4444',
            color: '#ef4444',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {formatTime(currentTime)}
        </div>
      )}
    </>
  )
}

// 需要引入 useProjectStore 来在拖拽时更新时间
import useProjectStore from '@/store/useProjectStore'

export default Playhead
