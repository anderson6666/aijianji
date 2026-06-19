import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react'

interface TimelineRulerProps {
  width: number
  height: number
  pixelsPerSecond: number
  totalDuration: number
  scrollLeft: number
  onClick: (time: number) => void
}

function TimelineRuler({
  width,
  height,
  pixelsPerSecond,
  totalDuration,
  scrollLeft,
  onClick,
}: TimelineRulerProps) {
  // 测量实际容器可视宽度（而非 window.innerWidth）
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1000)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // 初始测量：取父级滚动容器的可视宽度
    const updateWidth = () => {
      const parent = el.parentElement?.parentElement // scrollContainerRef 对应的 div
      if (parent) {
        setContainerWidth(parent.clientWidth)
      }
    }
    updateWidth()

    // 监听窗口大小变化和容器变化
    const observer = new ResizeObserver(updateWidth)
    const scrollParent = el.parentElement?.parentElement
    if (scrollParent) observer.observe(scrollParent)

    return () => observer.disconnect()
  }, [])

  // 根据缩放级别动态计算刻度间隔
  const ticks = useMemo(() => {
    const result: { time: number; isMajor: boolean; label?: string }[] = []

    // 确定合适的刻度间隔
    let interval: number
    let minorInterval: number

    if (pixelsPerSecond >= 120) {
      interval = 0.5   // 每0.5秒一个大刻度
      minorInterval = 0.1
    } else if (pixelsPerSecond >= 60) {
      interval = 1     // 每1秒
      minorInterval = 0.25
    } else if (pixelsPerSecond >= 30) {
      interval = 2     // 每2秒
      minorInterval = 0.5
    } else if (pixelsPerSecond >= 15) {
      interval = 5     // 每5秒
      minorInterval = 1
    } else {
      interval = 10    // 每10秒
      minorInterval = 2
    }

    // 生成刻度
    for (let t = 0; t <= totalDuration; t += minorInterval) {
      const isMajor = Math.abs(t % interval) < 0.001 || Math.abs(t % interval - interval) < 0.001
      result.push({
        time: t,
        isMajor,
        label: isMajor ? formatRulerTime(t) : undefined,
      })
    }

    return result
  }, [pixelsPerSecond, totalDuration])

  function formatRulerTime(timeSec: number): string {
    const minutes = Math.floor(timeSec / 60)
    const seconds = Math.floor(timeSec % 60)
    if (minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    }
    return `${seconds}s`
  }

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + scrollLeft
    const time = x / pixelsPerSecond
    onClick(Math.max(0, time))
  }, [scrollLeft, pixelsPerSecond, onClick])

  // 裁剪阈值：使用实际容器宽度 + 缓冲区（标签文字约需 40px 额外空间）
  const visibleRight = containerWidth + 50

  return (
    <div
      ref={containerRef}
      className="timeline-ruler absolute left-0 top-0 z-10 cursor-pointer"
      style={{ height, width }}
      onClick={handleClick}
    >
      {ticks.map((tick, index) => {
        const x = tick.time * pixelsPerSecond - scrollLeft
        // 使用实际容器宽度裁剪，修复长视频滚动后刻度被错误隐藏的问题
        if (x < -20 || x > visibleRight) return null

        return (
          <React.Fragment key={index}>
            {/* 刻度线 */}
            <div
              className={`ruler-tick ${tick.isMajor ? 'ruler-tick-major' : ''}`}
              style={{
                left: x,
                height: tick.isMajor ? height : height * 0.5,
                top: tick.isMajor ? 0 : height * 0.5,
              }}
            />
            {/* 大刻度标签 */}
            {tick.isMajor && tick.label && (
              <span
                className="ruler-label"
                style={{ left: x }}
              >
                {tick.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default TimelineRuler
