import React, { useCallback, useRef, useEffect, useState } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Magnet,
  Sparkles,
} from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import useTimelineStore from '@/store/useTimelineStore'
import type { Material } from '@/types'
import TimelineRuler from './TimelineRuler'
import TrackRow from './TrackRow'
import EffectTrackRow from './EffectTrackRow'
import Playhead from './Playhead'
import Tooltip from '@/components/Common/Tooltip'

function Timeline() {
  const tracksAreaRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropPosition, setDropPosition] = useState<{ trackId: string; time: number } | null>(null)

  // Store 数据
  const project = useProjectStore((s) => s.project)
  const currentTime = useProjectStore((s) => s.currentTime)
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime)
  const addTrack = useProjectStore((s) => s.addTrack)
  const selectClip = useProjectStore((s) => s.selectClip)
  const addClip = useProjectStore((s) => s.addClip)

  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond)
  const headerWidth = useTimelineStore((s) => s.headerWidth)
  const trackHeight = useTimelineStore((s) => s.trackHeight)
  const rulerHeight = useTimelineStore((s) => s.rulerHeight)
  const scrollLeft = useTimelineStore((s) => s.scrollLeft)
  const scrollTop = useTimelineStore((s) => s.scrollTop)
  const setScroll = useTimelineStore((s) => s.setScroll)
  const pixelToTime = useTimelineStore((s) => s.pixelToTime)
  const zoomIn = useTimelineStore((s) => s.zoomIn)
  const zoomOut = useTimelineStore((s) => s.zoomOut)
  const resetZoom = useTimelineStore((s) => s.resetZoom)
  const snapEnabled = useTimelineStore((s) => s.snapEnabled)
  const snapThreshold = useTimelineStore((s) => s.snapThreshold)
  const toggleSnap = useTimelineStore((s) => s.toggleSnap)

  // 同步滚动位置
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget
      setScroll(target.scrollLeft, target.scrollTop)
    },
    [setScroll]
  )

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
      }
    },
    [zoomIn, zoomOut]
  )

  // 点击时间轴空白区域取消选择
  const handleTracksAreaClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('tracks-area-bg')) {
        selectClip(null)
      }
    },
    [selectClip]
  )

  // 标尺点击跳转
  const handleRulerClick = useCallback(
    (time: number) => {
      setCurrentTime(time)
    },
    [setCurrentTime]
  )

  // ====== 从素材库拖放到时间轴 ======
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)

      // 计算放置位置
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = e.clientX - rect.left + scrollContainerRef.current?.scrollLeft
      const y = e.clientY - rect.top

      // 确定目标轨道
      const trackIndex = Math.floor(
        (y - rulerHeight) / trackHeight
      )
      const targetTrack =
        project.tracks[Math.max(0, Math.min(trackIndex, project.tracks.length - 1))]

      if (targetTrack) {
        setDropPosition({
          trackId: targetTrack.id,
          time: Math.max(0, pixelToTime(x)),
        })
      }
    },
    [project.tracks, rulerHeight, trackHeight, pixelToTime]
  )

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
    setDropPosition(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      setDropPosition(null)

      try {
        const data = e.dataTransfer.getData('application/cinestudio-material')
        if (!data) return

        const material: Material = JSON.parse(data)

        // 确定目标轨道
        let targetTrackId: string | undefined
        if (dropPosition) {
          targetTrackId = dropPosition.trackId
        } else {
          // 兜底：找匹配类型的第一个轨道
          const matchingTrack = project.tracks.find(
            (t) =>
              (material.type === 'video' || material.type === 'image') &&
              t.type === 'video'
          ) ||
            project.tracks.find(
              (t) => material.type === 'audio' && t.type === 'audio'
            ) ||
            project.tracks[0]
          targetTrackId = matchingTrack?.id
        }

        if (!targetTrackId) return

        // 计算放置时间：吸附逻辑
        // 1. 如果目标轨道为空（无片段），自动吸附到 0s
        // 2. 如果吸附开启且放置位置在阈值内接近 0s，吸附到 0s
        const targetTrackData = project.tracks.find(t => t.id === targetTrackId)
        const isTrackEmpty = !targetTrackData || targetTrackData.clips.length === 0
        let placeTime = dropPosition?.time ?? 0

        if (snapEnabled && (isTrackEmpty || placeTime <= pixelToTime(snapThreshold))) {
          placeTime = 0
        }

        addClip(targetTrackId, {
          materialId: material.id,
          startTime: placeTime,
          duration: material.duration,
          effects: [],
          volume: 100,
          opacity: 100,
          speed: 1,
        })
      } catch {
        /* JSON 解析失败则忽略 */
      }
    },
    [project.tracks, dropPosition, addClip, pixelToTime, snapEnabled, snapThreshold]
  )

  // 计算时间轴总宽度（至少显示60秒）
  const totalDuration = Math.max(project.duration, 60)
  const timelineWidth = totalDuration * pixelsPerSecond

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        height: 250,
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-color)',
      }}
    >
      {/* 工具栏：缩放控制 + 吸附 + 添加轨道 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-1">
          <Tooltip content="缩小">
            <button onClick={zoomOut} className="btn-icon" style={{ width: 28, height: 28 }}>
              <ZoomOut size={14} />
            </button>
          </Tooltip>

          {/* 缩放滑块 */}
          <input
            type="range"
            min={10}
            max={200}
            value={pixelsPerSecond}
            onChange={(e) =>
              useTimelineStore.getState().setPixelsPerSecond(Number(e.target.value))
            }
            className="w-24 property-slider"
          />

          <Tooltip content="放大">
            <button onClick={zoomIn} className="btn-icon" style={{ width: 28, height: 28 }}>
              <ZoomIn size={14} />
            </button>
          </Tooltip>
          <Tooltip content="重置缩放">
            <button onClick={resetZoom} className="btn-icon" style={{ width: 28, height: 28 }}>
              <Maximize2 size={14} />
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content={snapEnabled ? '关闭吸附' : '开启吸附'}>
            <button
              onClick={toggleSnap}
              className={`btn-icon ${snapEnabled ? 'active' : ''}`}
              style={{ width: 28, height: 28 }}
            >
              <Magnet size={14} />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-cine-border mx-1" />

          <Tooltip content="添加视频轨道">
            <button
              onClick={() => addTrack('video')}
              className="btn-icon"
              style={{ width: 28, height: 28 }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
          <Tooltip content="添加音频轨道">
            <button
              onClick={() => addTrack('audio')}
              className="btn-icon"
              style={{ width: 28, height: 28 }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 时间轴主体 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧轨道头列 */}
        <div
          className="shrink-0 overflow-y-auto overflow-x-hidden"
          style={{
            width: headerWidth,
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-color)',
          }}
          onScroll={(e) => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop =
                e.currentTarget.scrollTop
            }
          }}
        >
          <div style={{ height: rulerHeight }} />
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center px-3 border-b text-xs font-medium truncate"
              style={{
                height: trackHeight,
                borderColor: 'var(--border-color)',
                color: 'var(--text-secondary)',
                background:
                  track.type === 'video'
                    ? 'rgba(59,130,246,0.06)'
                    : track.type === 'audio'
                    ? 'rgba(16,185,129,0.06)'
                    : 'rgba(168,85,247,0.06)',
              }}
            >
              <span className="truncate">{track.name}</span>
            </div>
          ))}
          {/* 效果轨道头 */}
          <div
            className="flex items-center px-3 border-b text-xs font-medium truncate"
            style={{
              height: trackHeight * 0.6,
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
              background: 'rgba(88,28,135,0.08)',
            }}
          >
            <Sparkles size={11} className="mr-1.5 text-neon-purple/70" />
            <span className="truncate">效果轨道</span>
          </div>
        </div>

        {/* 右侧标尺+轨道区域（同步滚动） */}
        <div
          ref={scrollContainerRef}
          className="flex-1 relative overflow-auto"
          onScroll={handleScroll}
          onWheel={handleWheel}
        >
          <div
            ref={tracksAreaRef}
            className={`relative tracks-area-bg ${isDragOver ? 'drag-over-active' : ''}`}
            onClick={handleTracksAreaClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ minWidth: timelineWidth, paddingTop: rulerHeight }}
          >
            {/* 时间标尺 */}
            <TimelineRuler
              width={timelineWidth}
              height={rulerHeight}
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
              scrollLeft={scrollLeft}
              onClick={handleRulerClick}
            />

            {/* 轨道列表 */}
            <div>
              {project.tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  height={trackHeight}
                  pixelsPerSecond={pixelsPerSecond}
                  totalDuration={totalDuration}
                />
              ))}
            </div>

            {/* 效果轨道：聚合显示所有片段上的效果 */}
            <EffectTrackRow
              height={trackHeight * 0.6}
              pixelsPerSecond={pixelsPerSecond}
              totalDuration={totalDuration}
            />

            {/* 播放头 */}
            <Playhead
              currentTime={currentTime}
              pixelsPerSecond={pixelsPerSecond}
              totalTracks={project.tracks.length + 1} // +1 for effect track
              trackHeight={trackHeight}
              rulerHeight={rulerHeight}
            />

            {/* 拖放位置指示线 */}
            {isDragOver && dropPosition && (
              <div
                className="absolute top-0 bottom-0 w-0.5 pointer-events-none z-50"
                style={{
                  left: dropPosition.time * pixelsPerSecond,
                  background: 'var(--accent-cyan)',
                  boxShadow: '0 0 8px var(--accent-cyan)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Timeline
