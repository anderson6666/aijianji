import React, { useCallback, useRef, useState } from 'react'
import {
  Upload,
  Video,
  Image,
  Music,
  LayoutGrid,
  List,
  Trash2,
  Play,
  PlusCircle,
  Film,
} from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import type { Material } from '@/types'
import Tooltip from '@/components/Common/Tooltip'

function MaterialLibrary() {
  // 状态
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    materialId: string
  } | null>(null)

  // Store
  const project = useProjectStore((s) => s.project)
  const addMaterial = useProjectStore((s) => s.addMaterial)
  const removeMaterial = useProjectStore((s) => s.removeMaterial)
  const addClip = useProjectStore((s) => s.addClip)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 导入素材文件
  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files) return

      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file)
        const isVideo = file.type.startsWith('video/')
        const isImage = file.type.startsWith('image/')
        const isAudio = file.type.startsWith('audio/')

        let type: Material['type'] = 'video'
        if (isVideo) type = 'video'
        else if (isImage) type = 'image'
        else if (isAudio) type = 'audio'

        // 先用默认值添加素材，异步获取真实时长后更新
        const materialId = addMaterial({
          name: file.name.replace(/\.[^/.]+$/, ''),
          type,
          url,
          duration: isImage ? 5 : 0, // 图片默认5s，视频/音频等元数据
          thumbnail: undefined,
          width: undefined,
          height: undefined,
        })

        // 异步获取真实的媒体时长和缩略图
        if (isVideo || isAudio) {
          const mediaEl = document.createElement(isVideo ? 'video' : 'audio') as HTMLMediaElement
          mediaEl.preload = 'metadata'
          mediaEl.muted = true

          mediaEl.onloadedmetadata = () => {
            const realDuration = mediaEl.duration

            // 视频生成缩略图
            let thumbUrl: string | undefined
            if (isVideo) {
              mediaEl.currentTime = Math.min(1, realDuration * 0.1)
              mediaEl.onseeked = () => {
                try {
                  const canvas = document.createElement('canvas')
                  canvas.width = 160
                  canvas.height = 90
                  const ctx = canvas.getContext('2d')
                  if (ctx) {
                    ctx.drawImage(mediaEl as HTMLVideoElement, 0, 0, 160, 90)
                    thumbUrl = canvas.toDataURL('image/jpeg', 0.7)
                  }
                  // 更新素材的时长和缩略图
                  useProjectStore.getState().updateMaterial(materialId, {
                    duration: realDuration,
                    thumbnail: thumbUrl,
                    width: (mediaEl as HTMLVideoElement).videoWidth,
                    height: (mediaEl as HTMLVideoElement).videoHeight,
                  })
                } catch {
                  // 缩略图生成失败时至少更新时长
                  useProjectStore.getState().updateMaterial(materialId, {
                    duration: realDuration,
                  })
                }
              }
            } else {
              // 音频只更新时长
              useProjectStore.getState().updateMaterial(materialId, {
                duration: realDuration,
              })
            }
          }

          mediaEl.onerror = () => {
            // 加载失败时保持默认值
            if (!isVideo && !isAudio) return
            useProjectStore.getState().updateMaterial(materialId, {
              duration: 10, // 无法获取时长时的兜底
            })
          }

          mediaEl.src = url
        }
      })

      // 重置 input 以允许重复选择同一文件
      e.target.value = ''
    },
    [addMaterial]
  )

  // 关闭右键菜单
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // 右键菜单操作
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, materialId: string) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, materialId })
    },
    []
  )

  // 添加到时间轴（第一个视频/效果轨道）
  const handleAddToTimeline = useCallback(
    (materialId: string) => {
      const material = project.materials.find((m) => m.id === materialId)
      if (!material) return

      // 找到匹配类型的轨道
      const targetTrack =
        project.tracks.find(
          (t) =>
            (material.type === 'video' || material.type === 'image') &&
            t.type === 'video'
        ) ||
        project.tracks.find(
          (t) => material.type === 'audio' && t.type === 'audio'
        ) ||
        project.tracks[0]

      if (!targetTrack) return

      // 计算该轨道上最后一个片段的结束时间
      const lastClipEnd = targetTrack.clips.reduce(
        (max, clip) => Math.max(max, clip.startTime + clip.duration),
        0
      )

      addClip(targetTrack.id, {
        materialId: material.id,
        startTime: lastClipEnd + 0.1,
        duration: material.duration,
        effects: [],
        volume: 100,
        opacity: 100,
        speed: 1,
      })

      closeContextMenu()
    },
    [project.materials, project.tracks, addClip, closeContextMenu]
  )

  // 删除素材
  const handleDelete = useCallback(
    (materialId: string) => {
      removeMaterial(materialId)
      closeContextMenu()
    },
    [removeMaterial, closeContextMenu]
  )

  // 点击外部关闭右键菜单
  React.useEffect(() => {
    if (!contextMenu) return
    document.addEventListener('mousedown', closeContextMenu)
    return () => document.removeEventListener('mousedown', closeContextMenu)
  }, [contextMenu, closeContextMenu])

  // 拖拽到时间轴的数据传递
  const handleDragStart = useCallback(
    (e: React.DragEvent, material: Material) => {
      e.dataTransfer.setData(
        'application/cinestudio-material',
        JSON.stringify(material)
      )
      e.dataTransfer.effectAllowed = 'copy'
    },
    []
  )

  // 类型图标映射
  const getTypeIcon = (type: Material['type']) => {
    switch (type) {
      case 'video':
        return <Video size={14} />
      case 'image':
        return <Image size={14} />
      case 'audio':
        return <Music size={14} />
    }
  }

  const formatDuration = (sec: number): string => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏：导入 + 视图切换 */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <Tooltip content="导入素材 (支持视频/图片/音频)">
          <button onClick={handleImport} className="btn-capsule btn-primary text-xs py-1.5 px-3 gap-1.5">
            <Upload size={13} />
            导入
          </button>
        </Tooltip>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*,audio/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            style={{ width: 26, height: 26 }}
            title="网格视图"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            style={{ width: 26, height: 26 }}
            title="列表视图"
          >
            <List size={13} />
          </button>
        </div>
      </div>

      {/* 素材列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {project.materials.length === 0 ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Film size={40} className="text-text-muted opacity-30 mb-3" />
            <p className="text-sm text-text-muted mb-1">暂无素材</p>
            <p className="text-xs text-text-muted opacity-60 mb-4">
              点击导入按钮添加视频、图片或音频
            </p>
            <button
              onClick={handleImport}
              className="btn-capsule btn-ghost text-xs py-1.5 px-4 gap-1.5"
            >
              <PlusCircle size={14} />
              选择文件
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* 网格视图 */
          <div className="grid grid-cols-2 gap-2">
            {project.materials.map((material) => (
              <div
                key={material.id}
                className="material-card animate-fade-in"
                draggable
                onDragStart={(e) => handleDragStart(e, material)}
                onContextMenu={(e) => handleContextMenu(e, material.id)}
              >
                {/* 缩略图 */}
                <div className="material-thumbnail">
                  {material.thumbnail ? (
                    <img src={material.thumbnail} alt={material.name} />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      {getTypeIcon(material.type)}
                      <span className="text-[10px]">{material.type}</span>
                    </div>
                  )}
                </div>

                {/* 信息栏 */}
                <div className="p-2">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {material.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      {getTypeIcon(material.type)}
                      {material.type === 'video' && formatDuration(material.duration)}
                      {material.type === 'audio' && formatDuration(material.duration)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 列表视图 */
          <div className="flex flex-col gap-1">
            {project.materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center gap-2.5 p-2 rounded-md hover:bg-cine-hover cursor-pointer transition-colors group"
                draggable
                onDragStart={(e) => handleDragStart(e, material)}
                onContextMenu={(e) => handleContextMenu(e, material.id)}
              >
                {/* 缩略图小图标 */}
                <div
                  className="w-10 h-7 rounded bg-cine-surface flex items-center justify-center shrink-0 overflow-hidden"
                >
                  {material.thumbnail ? (
                    <img
                      src={material.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-text-muted">
                      {getTypeIcon(material.type)}
                    </span>
                  )}
                </div>

                {/* 信息 */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {material.name}
                  </p>
                  <p className="text-[10px] text-text-muted">
                    {material.type.toUpperCase()}
                    {material.type !== 'image' &&
                      ` · ${formatDuration(material.duration)}`}
                  </p>
                </div>

                {/* 快捷添加按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddToTimeline(material.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 btn-icon transition-opacity"
                  style={{ width: 24, height: 24 }}
                  title="添加到时间轴"
                >
                  <PlusCircle size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="context-menu-item"
            onClick={() => handleAddToTimeline(contextMenu.materialId)}
          >
            <Play size={14} />
            添加到时间轴
          </div>
          <div
            className="context-menu-item danger"
            onClick={() => handleDelete(contextMenu.materialId)}
          >
            <Trash2 size={14} />
            删除素材
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialLibrary
