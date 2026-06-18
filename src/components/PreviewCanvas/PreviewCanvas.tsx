import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MonitorPlay,
  ShieldCheck,
} from 'lucide-react'
import { VideoRenderer } from '@/engine'
import useProjectStore from '@/store/useProjectStore'
import type { Layer } from '@/types'
import Tooltip from '@/components/Common/Tooltip'

/**
 * 视频预览画布 - 负责将项目数据同步到渲染引擎并实时播放
 */
function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<VideoRenderer | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const loadedUrlsRef = useRef<Set<string>>(new Set()) // 已加载的素材URL，避免重复加载

  // Store 状态
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const currentTime = useProjectStore((s) => s.currentTime)
  const project = useProjectStore((s) => s.project)
  const togglePlay = useProjectStore((s) => s.togglePlay)
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime)

  // UI 状态
  const [volume, setVolume] = useState(100)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSafeArea, setShowSafeArea] = useState(false)
  const [canvasVisible, setCanvasVisible] = useState(true) // 鼠标悬停隐藏画布
  const containerRef = useRef<HTMLDivElement>(null)

  // ====== 初始化渲染器 ======
  useEffect(() => {
    if (!canvasRef.current || rendererRef.current) return

    const canvas = canvasRef.current
    canvas.width = 1920
    canvas.height = 1080

    try {
      const renderer = new VideoRenderer(canvas)
      rendererRef.current = renderer

      // 素材加载就绪时自动刷新画面
      renderer.setOnSourceReady(() => {
        const state = useProjectStore.getState()
        if (!state.isPlaying && rendererRef.current) {
          try {
            rendererRef.current.renderFrame(state.currentTime)
          } catch { /* 静默 */ }
        }
      })

      // 浏览器自动播放策略：在首次用户交互时同步恢复 AudioContext
      // 必须在用户手势的同步调用链中调用，useEffect 异步回调中调用会被拒绝
      const unlockAudio = () => {
        renderer.resumeAudio()
        document.removeEventListener('pointerdown', unlockAudio)
        document.removeEventListener('keydown', unlockAudio)
      }
      document.addEventListener('pointerdown', unlockAudio, { once: false })
      document.addEventListener('keydown', unlockAudio, { once: false })
    } catch (err) {
      console.error('初始化视频渲染器失败:', err)
    }

    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
      loadedUrlsRef.current.clear()
    }
  }, [])

  // ====== 核心同步：项目数据 → 渲染器图层（仅同步数据，不触发渲染）======
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    const { tracks, materials } = project

    // 收集所有需要显示的视频/图片片段
    const layers: Layer[] = []
    let zIndex = 0

    for (const track of tracks) {
      if (track.type !== 'video' || !track.visible) continue

      for (const clip of track.clips) {
        // 查找素材
        const material = materials.find((m) => m.id === clip.materialId)
        if (!material) continue
        if (material.type === 'audio') continue // 音频不在视频轨道渲染

        // 异步加载素材（仅首次）
        const url = material.url
        if (!loadedUrlsRef.current.has(url)) {
          loadedUrlsRef.current.add(url)
          // 检测 blob URL 是否可能已失效（以 blob: 开头但在当前会话中可能已被撤销）
          if (url.startsWith('blob:')) {
            // 尝试探测URL是否有效
            try {
              const testFetch = fetch(url, { method: 'HEAD', mode: 'no-cors' })
              testFetch.catch(() => {
                console.warn('[PreviewCanvas] 素材blob URL可能失效，建议重新导入:', material.name)
              })
            } catch { /* 忽略 */ }
          }

          if (material.type === 'video') {
            renderer.loadVideo(url).catch((err) =>
              console.warn('视频加载失败:', url, err)
            )
          } else if (material.type === 'image') {
            renderer.loadImage(url).catch((err) =>
              console.warn('图片加载失败:', url, err)
            )
          }
        }

        // 创建图层：将片段映射为渲染层
        const layer: Layer = {
          id: clip.id,
          source: {
            id: material.id,
            type: material.type === 'image' ? 'image' : 'video',
            url: url,
            startTime: clip.startTime,
            duration: clip.duration / Math.max(clip.speed, 0.01), // 考虑速度
          },
          transform: {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
          },
          opacity: Math.max(0, Math.min(100, clip.opacity)) / 100,
          visible: true,
          zIndex: zIndex++,
        }

        layers.push(layer)
      }
    }

    // 更新渲染器图层（批量操作，减少中间状态）
    // 重要：先清空再添加 layers（clearLayers 会重置 layerEffects 映射）
    renderer.clearLayers()
    for (const layer of layers) {
      renderer.addLayer(layer)
    }

    // 重新同步所有效果到渲染器（必须在 clearLayers 之后）
    for (const track of tracks) {
      if (track.type !== 'video' || !track.visible) continue
      for (const clip of track.clips) {
        renderer.setLayerEffects(clip.id, clip.effects)
      }
    }
  }, [project.tracks, project.materials]) // 当轨道或素材变化时重新同步

  // ====== 播放循环 ======
  useEffect(() => {
    if (!rendererRef.current) return

    if (isPlaying) {
      // 恢复音频上下文并播放视频原生音频
      rendererRef.current.resumeAudio()
      rendererRef.current.playAudio()

      lastTimeRef.current = performance.now()

      const tick = (now: number) => {
        const delta = (now - lastTimeRef.current) / 1000
        lastTimeRef.current = now

        // 使用 getState() 获取最新状态，避免闭包捕获旧值
        const state = useProjectStore.getState()
        const currentTime = state.currentTime
        const projectDuration = state.project.duration

        const nextTime = Math.min(
          currentTime + delta,
          Math.max(projectDuration, 0.01)
        )
        state.setCurrentTime(nextTime)

        // 渲染帧
        try {
          rendererRef.current!.renderFrame(nextTime)
        } catch {
          /* 静默处理 */
        }

        // 到达末尾时停止或循环
        if (nextTime >= projectDuration && projectDuration > 0) {
          state.togglePlay()
          state.setCurrentTime(0)
          return
        }

        animFrameRef.current = requestAnimationFrame(tick)
      }

      animFrameRef.current = requestAnimationFrame(tick)
    } else {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }
      // 暂停视频音频
      rendererRef.current.pauseAudio()
      // 静态时也渲染当前帧
      try {
        rendererRef.current.renderFrame(useProjectStore.getState().currentTime)
      } catch {
        /* 静默 */
      }
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying])

  // ====== 统一渲染：时间变化或数据变化时重新渲染（非播放状态）======
  useEffect(() => {
    if (!isPlaying && rendererRef.current) {
      try {
        rendererRef.current.renderFrame(currentTime)
      } catch {
        /* 静默 */
      }
    }
  }, [currentTime, isPlaying, project.tracks]) // 数据变化时也触发重绘

  // 格式化时间码 MM:SS:FF
  const formatTimecode = useCallback(
    (timeSec: number): string => {
      const fps = project.fps || 30
      const totalFrames = Math.floor(timeSec * fps)
      const minutes = Math.floor(totalFrames / (60 * fps))
      const seconds = Math.floor((totalFrames % (60 * fps)) / fps)
      const frames = totalFrames % fps
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
        2,
        '0'
      )}:${String(frames).padStart(2, '0')}`
    },
    [project.fps]
  )

  // 跳转到开始/结束
  const skipToStart = () => {
    setCurrentTime(0)
    if (isPlaying) togglePlay()
  }

  const skipToEnd = () => {
    setCurrentTime(Math.max(project.duration, 0))
    if (isPlaying) togglePlay()
  }

  // 播放/暂停：在用户手势同步上下文中启动音频（浏览器自动播放策略要求）
  const handleTogglePlay = useCallback(() => {
    if (!isPlaying && rendererRef.current) {
      // 同步恢复 AudioContext 并播放视频原生音频
      rendererRef.current.resumeAudio()
      rendererRef.current.playAudio()
    }
    togglePlay()
  }, [isPlaying, togglePlay])

  // 进度条拖动状态
  const [isSeeking, setIsSeeking] = useState(false)

  // 进度条点击/拖动跳转
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const duration = Math.max(project.duration, 1)
      setCurrentTime(ratio * duration)
    },
    [project.duration, setCurrentTime]
  )

  // 进度条拖动开始
  const handleSeekMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsSeeking(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
        const duration = Math.max(project.duration, 1)
        useProjectStore.getState().setCurrentTime(ratio * duration)
      }

      const handleMouseUp = () => {
        setIsSeeking(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [project.duration]
  )

  // 全屏切换
  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      // 全屏 API 可能被拒绝
    }
  }

  // 监听全屏变化
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const progressPercent =
    project.duration > 0 ? (currentTime / project.duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 min-w-0 relative overflow-hidden"
    >
      {/* Canvas 预览区域 */}
      <div
        className="canvas-container flex-1 m-3 min-h-0"
        onMouseEnter={() => setCanvasVisible(false)}
        onMouseLeave={() => setCanvasVisible(true)}
      >
        <canvas ref={canvasRef} style={{ visibility: canvasVisible ? 'visible' : 'hidden' }} />

        {/* 安全区域叠加层 */}
        {showSafeArea && <div className="safe-area-overlay" />}

        {/* 无素材提示 */}
        {project.materials.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <MonitorPlay
              size={48}
              className="text-text-muted mb-3 opacity-40"
            />
            <p className="text-text-muted text-sm opacity-50">
              导入素材开始创作
            </p>
          </div>
        )}

        {/* 无片段提示 */}
        {project.materials.length > 0 &&
          project.tracks.every((t) => t.clips.length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <Play size={32} className="text-neon-cyan mb-2 opacity-30" />
              <p className="text-text-muted text-xs opacity-50">
                将素材拖入下方时间轴开始编辑
              </p>
            </div>
          )}
      </div>

      {/* 播放控制条 */}
      <div
        className="shrink-0 px-4 pb-3 pt-1"
        style={{ background: 'var(--bg-panel)' }}
      >
        {/* 进度条 */}
        <div
          className={`seek-bar mb-3 ${isSeeking ? 'seeking' : ''}`}
          onClick={handleSeek}
          onMouseDown={handleSeekMouseDown}
        >
          <div
            className="seek-bar-progress"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="seek-bar-thumb"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* 控制按钮行 */}
        <div className="flex items-center gap-3">
          {/* 左侧：播放控制 */}
          <div className="flex items-center gap-1">
            <Tooltip content="跳到开头">
              <button onClick={skipToStart} className="btn-icon">
                <SkipBack size={16} />
              </button>
            </Tooltip>

            <Tooltip content={isPlaying ? '暂停 (Space)' : '播放 (Space)'}>
              <button
                onClick={handleTogglePlay}
                className="btn-icon"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: isPlaying
                    ? 'rgba(255,255,255,0.08)'
                    : 'var(--accent-cyan)',
                  color: isPlaying ? 'var(--text-primary)' : '#fff',
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </Tooltip>

            <Tooltip content="跳到结尾">
              <button onClick={skipToEnd} className="btn-icon">
                <SkipForward size={16} />
              </button>
            </Tooltip>
          </div>

          {/* 时间码显示 */}
          <div className="font-mono text-xs text-text-secondary select-none min-w-[110px]">
            <span className="text-neon-cyan">
              {formatTimecode(currentTime)}
            </span>
            <span className="mx-1.5 text-text-muted">/</span>
            <span>{formatTimecode(project.duration)}</span>
          </div>

          {/* 弹性空间 */}
          <div className="flex-1" />

          {/* 右侧：音量、安全区域、全屏 */}
          <div className="flex items-center gap-1">
            <Tooltip content={showSafeArea ? '隐藏安全区' : '显示安全区'}>
              <button
                onClick={() => setShowSafeArea(!showSafeArea)}
                className={`btn-icon ${showSafeArea ? 'active' : ''}`}
              >
                <ShieldCheck size={16} />
              </button>
            </Tooltip>

            <Tooltip content={isMuted ? '取消静音' : '静音'}>
              <button
                onClick={() => {
                  const newMuted = !isMuted
                  setIsMuted(newMuted)
                  rendererRef.current?.setVolume(newMuted ? 0 : volume)
                }}
                className="btn-icon"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </button>
            </Tooltip>

            {/* 音量滑块 */}
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const newVolume = Number(e.target.value)
                setVolume(newVolume)
                if (newVolume > 0) setIsMuted(false)
                // 同步到渲染器音频输出
                rendererRef.current?.setVolume(isMuted ? 0 : newVolume)
              }}
              className="w-20 property-slider"
            />

            <Tooltip content={isFullscreen ? '退出全屏' : '全屏'}>
              <button onClick={toggleFullscreen} className="btn-icon">
                {isFullscreen ? (
                  <Minimize size={16} />
                ) : (
                  <Maximize size={16} />
                )}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PreviewCanvas
