import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
  showClose?: boolean
}

function Dialog({
  open,
  onClose,
  title,
  children,
  width = '480px',
  showClose = true,
}: DialogProps) {
  // ESC 键关闭 + 背景锁定滚动
  useEffect(() => {
    if (!open) return

    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-container"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <h2 className="font-outfit font-semibold text-base text-text-primary">
            {title}
          </h2>
          {showClose && (
            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: 28, height: 28 }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* 内容区 */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export default Dialog
