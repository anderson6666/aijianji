import React, { useMemo } from 'react'

interface TimelineRulerProps {
  width: number
  height: number
  pixelsPerSecond: number
  totalDuration: number
  onClick: (e: React.MouseEvent) => void
}

/**
 * 时间标尺组件
 * 初始显示 1 小时（3600 秒），根据项目实际时长动态扩展
 */
function TimelineRuler({
  width,
  height,
  pixelsPerSecond,
  totalDuration,
  onClick,
}: TimelineRulerProps) {
  // 根据缩放级别选择刻度间隔
  const { ticks, interval } = useMemo(() => {
    // 大刻度间隔（带标签）
    let interval: number
    // 小刻度步进
    let minorStep: number

    if (pixelsPerSecond >= 120) {
      interval = 0.5; minorStep = 0.1
    } else if (pixelsPerSecond >= 60) {
      interval = 1; minorStep = 0.25
    } else if (pixelsPerSecond >= 30) {
      interval = 2; minorStep = 0.5
    } else if (pixelsPerSecond >= 15) {
      interval = 5; minorStep = 1
    } else if (pixelsPerSecond >= 6) {
      interval = 10; minorStep = 2
    } else if (pixelsPerSecond >= 2) {
      interval = 30; minorStep = 10
    } else {
      interval = 60; minorStep = 30
    }

    const result: { time: number; isMajor: boolean; label?: string }[] = []
    for (let t = 0; t <= totalDuration; t += minorStep) {
      const isMajor = t % interval < 0.001 || Math.abs(t % interval - interval) < 0.001
      result.push({
        time: t,
        isMajor,
        label: isMajor ? formatTime(t) : undefined,
      })
    }

    return { ticks: result, interval }
  }, [pixelsPerSecond, totalDuration])

  function formatTime(t: number): string {
    const s = Math.floor(t)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`
    return `${sec}s`
  }

  return (
    <div
      className="timeline-ruler absolute left-0 top-0 cursor-pointer"
      style={{ height, width, zIndex: 25 }}
      onClick={onClick}
    >
      {ticks.map((tick) => {
        const x = tick.time * pixelsPerSecond
        if (x < -20 || x > width + 50) return null

        return (
          <React.Fragment key={tick.time}>
            <div
              className={`ruler-tick ${tick.isMajor ? 'ruler-tick-major' : ''}`}
              style={{
                left: x,
                height: tick.isMajor ? height : height * 0.5,
                top: tick.isMajor ? 0 : height * 0.5,
              }}
            />
            {tick.isMajor && tick.label && (
              <span className="ruler-label" style={{ left: x }}>
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
