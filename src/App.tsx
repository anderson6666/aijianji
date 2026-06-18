import React, { useState, useCallback, useEffect } from 'react'
import Toolbar from '@/components/Toolbar/Toolbar'
import PreviewCanvas from '@/components/PreviewCanvas/PreviewCanvas'
import Timeline from '@/components/Timeline/Timeline'
import LeftSidebar from '@/components/Sidebar/LeftSidebar'
import RightSidebar from '@/components/Sidebar/RightSidebar'
import ExportDialog from '@/components/Dialog/ExportDialog'
import useProjectStore from '@/store/useProjectStore'

/**
 * CineStudio 视频编辑器 - 主应用组件
 * 三栏式专业编辑器布局：
 *   左侧面板(280px) | 中间预览区(flex-1) | 右侧面板(300px)
 *   顶部工具栏(56px)
 *   底部时间轴区域(250px)
 */
export default function App() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // 导出回调
  const handleExport = useCallback((quality: string) => {
    if (quality === 'custom') {
      setExportDialogOpen(true)
    } else {
      setExportDialogOpen(true)
    }
  }, [])

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { togglePlay, undo, selectedClipId, removeClip, selectClip } =
        useProjectStore.getState()

      // 空格：播放/暂停（非输入框时）
      if (e.code === 'Space' && !isInputTarget(e.target)) {
        e.preventDefault()
        togglePlay()
        return
      }

      // Ctrl+Z：撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      // Delete/Backspace：删除选中片段
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedClipId &&
        !isInputTarget(e.target)
      ) {
        e.preventDefault()
        removeClip(selectedClipId)
        selectClip(null)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-cine-bg font-outfit">
      {/* ====== 顶部工具栏 ====== */}
      <Toolbar onExport={handleExport} />

      {/* ====== 主内容区（三栏布局）====== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 左侧面板 */}
        <LeftSidebar />

        {/* 中间预览 + 时间轴 */}
        <main className="flex flex-col flex-1 min-w-0">
          {/* 预览画布 */}
          <PreviewCanvas />

          {/* 时间轴 */}
          <Timeline />
        </main>

        {/* 右侧面板 */}
        <RightSidebar />
      </div>

      {/* 导出对话框 */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      />
    </div>
  )
}

// 判断目标是否为输入元素（避免快捷键冲突）
function isInputTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const tag = (target as HTMLElement).tagName
  const isContentEditable = (target as HTMLElement).isContentEditable
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    isContentEditable
  )
}
