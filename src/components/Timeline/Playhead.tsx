import React, { useCallback, useRef, useState } from 'react'
import useProjectStore from '@/store/useProjectStore'

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
  const containerRef = useRef<HTMLDivElement>(null)

  // 播放头位置：在滚动容器内直接用时间计算即可
  const position = currentTime * pixelsPerSecond

  // 格式化时间
  const formatTime = (t: number): string => {
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 拖拽播放头
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // 找到滚动容器
      const scrollContainer = containerRef.current?.closest(
        '.overflow-auto'
      ) as HTMLDivElement | null
      if (!scrollContainer) return

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = scrollContainer.getBoundingClientRect()
        const x =
          moveEvent.clientX - rect.left + scrollContainer.scrollLeft
        const time = Math.max(0, x / pixelsPerSecond)
        useProjectStore.getState().setCurrentTime(time)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [pixelsPerSecond]
  )

  const totalHeight = rulerHeight + totalTracks * trackHeight

  return (
    <div
      ref={containerRef}
      className="playhead"
      style={{
        left: position,
        top: 0,
        height: totalHeight,
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
          height: `calc(100% - 8px)`,
          background:
            'linear-gradient(to bottom, #ef4444, rgba(239,68,68,0.6))',
        }}
      />

      {/* 时间标签 */}
      <div className="playhead-time">{formatTime(currentTime)}</div>
    </div>
  )
}

export default Playhead
