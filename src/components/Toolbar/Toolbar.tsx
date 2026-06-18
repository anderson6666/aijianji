import React, { useState, useCallback } from 'react'
import {
  Clapperboard,
  Undo2,
  Redo2,
  Settings,
  Film,
  Scissors,
  Trash2,
} from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import Tooltip from '@/components/Common/Tooltip'
import { ExportDropdown } from '@/components/Common/Dropdown'

function Toolbar({ onExport }: { onExport: (quality: string) => void }) {
  const [projectName, setProjectName] = useState(
    useProjectStore.getState().project.name
  )
  const project = useProjectStore((s) => s.project)
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const historyIndex = useProjectStore((s) => s.historyIndex)
  const historyLength = useProjectStore((s) => s.history.length)
  const selectedClipId = useProjectStore((s) => s.selectedClipId)
  const currentTime = useProjectStore((s) => s.currentTime)
  const removeClip = useProjectStore((s) => s.removeClip)
  const splitClip = useProjectStore((s) => s.splitClip)
  const getSelectedClip = useProjectStore((s) => s.getSelectedClip)

  // 项目名称修改（失焦或回车保存）
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setProjectName(e.target.value)
    },
    []
  )

  const handleNameBlur = useCallback(() => {
    if (projectName.trim()) {
      updateProjectName(projectName.trim())
    }
  }, [projectName, updateProjectName])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        ;(e.target as HTMLInputElement).blur()
      }
    },
    []
  )

  // 分割选中片段
  const handleSplitClip = useCallback(() => {
    if (!selectedClipId) return
    const clip = getSelectedClip()
    if (!clip) return

    // 在当前播放头位置分割（如果播放头在片段内）
    if (currentTime >= clip.startTime && currentTime <= clip.startTime + clip.duration) {
      splitClip(selectedClipId, currentTime)
    } else {
      // 在片段中间分割
      splitClip(selectedClipId, clip.startTime + clip.duration / 2)
    }
  }, [selectedClipId, currentTime, splitClip, getSelectedClip])

  // 删除选中片段
  const handleDeleteClip = useCallback(() => {
    if (!selectedClipId) return
    removeClip(selectedClipId)
  }, [selectedClipId, removeClip])

  return (
    <header
      className="flex items-center h-14 px-4 gap-4 shrink-0"
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      {/* Logo / 品牌标识 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-blue-600">
          <Clapperboard size={18} className="text-white" />
        </div>
        <span className="font-outfit font-bold text-base tracking-wide text-text-primary hidden sm:block">
          CineStudio
        </span>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-cine-border" />

      {/* 项目名称 */}
      <div className="flex items-center gap-1.5">
        <Film size={14} className="text-text-muted" />
        <input
          type="text"
          value={projectName}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          className="input-dark w-36 lg:w-48 text-sm font-medium py-1 px-3"
          placeholder="项目名称..."
        />
      </div>

      {/* 弹性空间 */}
      <div className="flex-1" />

      {/* 撤销/重做组 */}
      <div className="flex items-center gap-1">
        <Tooltip content="撤销 (Ctrl+Z)">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 size={16} />
          </button>
        </Tooltip>
        <Tooltip content="重做 (Ctrl+Y)">
          <button
            onClick={redo}
            disabled={historyIndex >= historyLength - 1}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Redo2 size={16} />
          </button>
        </Tooltip>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-cine-border" />

      {/* 分割/删除组 */}
      <div className="flex items-center gap-1">
        <Tooltip content={selectedClipId ? "分割片段 (在播放头位置)" : "请先选中片段"}>
          <button
            onClick={handleSplitClip}
            disabled={!selectedClipId}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Scissors size={16} />
          </button>
        </Tooltip>
        <Tooltip content={selectedClipId ? "删除片段 (Delete)" : "请先选中片段"}>
          <button
            onClick={handleDeleteClip}
            disabled={!selectedClipId}
            className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed text-red-400"
          >
            <Trash2 size={16} />
          </button>
        </Tooltip>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-cine-border" />

      {/* 导出按钮 */}
      <ExportDropdown onExport={onExport} />

      {/* 设置按钮 */}
      <Tooltip content="设置">
        <button className="btn-icon">
          <Settings size={16} />
        </button>
      </Tooltip>
    </header>
  )
}

export default Toolbar