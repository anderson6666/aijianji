import React from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react'
import type { Track, Clip } from '@/types'
import useProjectStore from '@/store/useProjectStore'
import ClipBlock from './ClipBlock'

interface TrackRowProps {
  track: Track
  height: number
  pixelsPerSecond: number
  totalDuration: number
}

function TrackRow({ track, height, pixelsPerSecond, totalDuration }: TrackRowProps) {
  const toggleTrackVisibility = useProjectStore((s) => s.toggleTrackVisibility)
  const toggleTrackLock = useProjectStore((s) => s.toggleTrackLock)
  const toggleTrackMute = useProjectStore((s) => s.toggleTrackMute)
  const selectedClipId = useProjectStore((s) => s.selectedClipId)
  const selectClip = useProjectStore((s) => s.selectClip)
  const updateClip = useProjectStore((s) => s.updateClip)
  const moveClip = useProjectStore((s) => s.moveClip)
  const removeClip = useProjectStore((s) => s.removeClip)
  const splitClip = useProjectStore((s) => s.splitClip)

  return (
    <div
      className="relative border-b group overflow-hidden"
      style={{
        height,
        borderColor: 'var(--border-color)',
        background:
          track.type === 'video'
            ? 'rgba(26,27,40,0.4)'
            : track.type === 'audio'
            ? 'rgba(6,78,59,0.15)'
            : 'rgba(88,28,135,0.12)',
      }}
    >
      {/* 轨道内控制按钮（hover时显示） */}
      <div
        className="absolute left-1 top-0 bottom-0 flex items-center gap-0.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        <div className="pointer-events-auto">
          <ControlButton
            active={track.visible}
            onClick={() => toggleTrackVisibility(track.id)}
            title={track.visible ? '隐藏轨道' : '显示轨道'}
          >
            {track.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </ControlButton>
        </div>
        <div className="pointer-events-auto">
          <ControlButton
            active={track.locked}
            onClick={() => toggleTrackLock(track.id)}
            title={track.locked ? '解锁轨道' : '锁定轨道'}
          >
            {track.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </ControlButton>
        </div>
        {track.type === 'audio' && (
          <div className="pointer-events-auto">
            <ControlButton
              active={track.muted}
              onClick={() => toggleTrackMute(track.id)}
              title={track.muted ? '取消静音' : '静音'}
            >
              {track.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </ControlButton>
          </div>
        )}
      </div>

      {/* 片段块列表 */}
      {!track.locked &&
        track.clips.map((clip) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            track={track}
            isSelected={clip.id === selectedClipId}
            pixelsPerSecond={pixelsPerSecond}
            onSelect={() => selectClip(clip.id)}
            onUpdate={(updates) => updateClip(clip.id, updates)}
            onMove={(newTrackId, newStartTime) =>
              moveClip(clip.id, newTrackId, newStartTime)
            }
            onDelete={() => removeClip(clip.id)}
            onSplit={(splitTime) => splitClip(clip.id, splitTime)}
          />
        ))}

      {/* 锁定状态的片段（只读显示） */}
      {track.locked &&
        track.clips.map((clip) => (
          <div
            key={clip.id}
            className="absolute top-[4px] h-[calc(100%-8px)] rounded opacity-50 cursor-not-allowed"
            style={{
              left: clip.startTime * pixelsPerSecond,
              width: clip.duration * pixelsPerSecond,
              background:
                track.type === 'video'
                  ? 'linear-gradient(135deg,#1a56db,#2563eb)'
                  : track.type === 'audio'
                  ? 'linear-gradient(135deg,#047857,#059669)'
                  : 'linear-gradient(135deg,#7c3aed,#8b5cf6)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span className="text-[10px] text-white/70 px-1.5 py-0.5 block truncate">
              {getMaterialName(clip.materialId)}
            </span>
          </div>
        ))}
    </div>
  )
}

// 小型控制按钮组件
function ControlButton({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors"
      style={{ color: active ? 'var(--accent-cyan)' : 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

// 获取素材名称辅助函数
function getMaterialName(materialId: string): string {
  const materials = useProjectStore.getState().project.materials
  const mat = materials.find((m) => m.id === materialId)
  return mat?.name || '片段'
}

export default TrackRow
