import React, { useState, useRef } from 'react'
import {
  Download,
  Film,
  Loader2,
} from 'lucide-react'
import Dialog from './Dialog'
import useProjectStore from '@/store/useProjectStore'
import { VideoRenderer } from '@/engine'
import PropertyInput from '@/components/PropertyPanel/PropertyInput'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

function ExportDialog({ open, onClose }: ExportDialogProps) {
  const project = useProjectStore((s) => s.project)
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime)
  const currentTime = useProjectStore((s) => s.currentTime)
  const isPlaying = useProjectStore((s) => s.isPlaying)
  const togglePlay = useProjectStore((s) => s.togglePlay)

  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animFrameRef = useRef<number | null>(null)

  // 质量预设
  const qualityPresets = {
    high: { label: '高清 (1080p)', width: 1920, height: 1080, fps: 30, bitrate: 5000000 },
    medium: { label: '标清 (720p)', width: 1280, height: 720, fps: 30, bitrate: 2500000 },
    low: { label: '流畅 (480p)', width: 854, height: 480, fps: 24, bitrate: 1000000 },
  }

  const currentPreset = qualityPresets[quality]

  // 获取支持的 WebM MIME 类型（同时指定视频+音频编码器确保兼容性）
  const getMimeType = (): string => {
    for (const mime of [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm',
    ]) {
      if (MediaRecorder.isTypeSupported(mime)) return mime
    }
    return 'video/webm'
  }

  // 触发文件下载
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  }

  // 纯录屏导出：canvas.captureStream() 录制画面，效果自动包含在画面中
  const handleExport = async () => {
    // 使用共享引用获取正确的预览画布（避免 querySelector 拿到素材缩略图等错误的 canvas）
    const canvas = VideoRenderer.sharedCanvas
    if (!canvas) {
      alert('预览渲染器未初始化，请先在预览区播放一次视频后重试')
      return
    }

    // 录屏期间强制显示 canvas（PreviewCanvas 会在鼠标悬停时隐藏它，导致 captureStream 捕获空白帧）
    const prevVisibility = canvas.style.visibility
    canvas.style.visibility = 'visible'

    setIsExporting(true)
    setExportProgress(0)
    chunksRef.current = []

    const mimeType = getMimeType()
    const duration = Math.max(project.duration, 0.1)
    const fps = currentPreset.fps

    try {
      // 纯录屏：captureStream 捕获 canvas 上所有绘制内容（含效果）
      const stream = canvas.captureStream(fps)

      // 将 VideoRenderer 的音频输出注入录制流（解决录屏无声音问题）
      // VideoRenderer 通过 createMediaElementSource 劫持了视频音频到 Web Audio API
      // captureStream 只捕获画面，必须手动混入音频轨道
      const audioStream = VideoRenderer.sharedAudioStream
      if (audioStream) {
        audioStream.getAudioTracks().forEach((track) => {
          stream.addTrack(track)
        })
      }

      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: currentPreset.bitrate,
      }

      const recorder = new MediaRecorder(stream, recorderOptions)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      const exportPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, { type: mimeType }))
        }
        recorder.onerror = () => reject(new Error('录制失败'))
      })

      // 先启动录制，再开始播放（确保不漏开头）
      recorder.start(100)

      const wasPlaying = isPlaying
      const previousTime = currentTime

      if (wasPlaying) togglePlay()

      setCurrentTime(0)
      await new Promise((r) => setTimeout(r, 300))

      togglePlay()

      // 监控进度
      await new Promise<void>((resolve) => {
        const checkProgress = () => {
          const state = useProjectStore.getState()
          const progress = Math.min(
            Math.round((state.currentTime / duration) * 100),
            99
          )
          setExportProgress(progress)

          if (state.currentTime >= duration - 0.05) {
            resolve()
          } else {
            animFrameRef.current = requestAnimationFrame(checkProgress)
          }
        }
        animFrameRef.current = requestAnimationFrame(checkProgress)
      })

      // 等待尾部帧和音频收尾
      await new Promise((r) => setTimeout(r, 500))

      const state = useProjectStore.getState()
      if (state.isPlaying) togglePlay()

      recorder.stop()
      setExportProgress(100)

      const blob = await exportPromise
      downloadBlob(blob, `${project.name || 'export'}.webm`)

      setCurrentTime(previousTime)
      if (wasPlaying) togglePlay()

      // 恢复 canvas 可见性
      canvas.style.visibility = prevVisibility

      setIsExporting(false)
      onClose()
    } catch (error) {
      console.error('导出失败:', error)
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`)
      // 恢复 canvas 可见性
      canvas.style.visibility = prevVisibility
      setIsExporting(false)

      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }

  // 取消导出
  const handleCancelExport = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
    }
    if (isPlaying) togglePlay()
    // 恢复 canvas 可见性
    const canvas = VideoRenderer.sharedCanvas
    if (canvas) canvas.style.visibility = ''
    setIsExporting(false)
    setExportProgress(0)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="导出视频"
      width="460px"
    >
      <div className="space-y-5">
        {/* 项目信息摘要 */}
        <div
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--bg-surface)' }}
        >
          <Film size={20} className="text-neon-cyan" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {project.name}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              时长 {project.duration.toFixed(1)}s · {project.tracks.reduce(
                (sum, t) => sum + t.clips.length,
                0
              )}{' '}
              个片段
            </p>
          </div>
        </div>

        {/* 质量选择 */}
        <div>
          <label className="property-label mb-2 block">画质</label>
          <div className="space-y-2">
            {(Object.entries(qualityPresets) as [keyof typeof qualityPresets, typeof qualityPresets.high][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setQuality(key)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                    quality === key
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : 'border-transparent bg-cine-surface hover:border-cine-border-light'
                  }`}
                  style={{
                    border: `1px solid ${
                      quality === key ? 'var(--accent-cyan)' : 'transparent'
                    }`,
                  }}
                >
                  <span className="text-sm font-medium text-text-primary">
                    {preset.label}
                  </span>
                  <span className="text-xs font-mono text-text-muted">
                    {preset.width}x{preset.height} @ {preset.fps}fps
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 帧率 */}
        <PropertyInput
          label="帧率 (FPS)"
          type="number"
          value={currentPreset.fps}
          min={12}
          max={60}
          step={1}
          onChange={() => {}}
        />

        {/* 导出进度条 */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                正在录屏导出...
              </span>
              <span className="font-mono text-neon-cyan">{exportProgress}%</span>
            </div>
            <div className="seek-bar h-2 cursor-default">
              <div
                className="seek-bar-progress"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={isExporting ? handleCancelExport : onClose}
            className="btn-capsule btn-ghost py-2"
          >
            {isExporting ? '取消导出' : '取消'}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn-capsule btn-primary py-2 gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                录制中...
              </>
            ) : (
              <>
                <Download size={14} />
                开始录屏
              </>
            )}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

export default ExportDialog
