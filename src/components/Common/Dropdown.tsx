import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownItem {
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  divider?: boolean
}

interface DropdownProps {
  trigger: React.ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

function Dropdown({ trigger, items, align = 'right' }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ESC 关闭
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={`dropdown-menu z-50 ${align === 'left' ? 'left-0 right-auto' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) =>
            item.divider ? (
              <div key={index} className="dropdown-divider" />
            ) : (
              <div
                key={index}
                className={`context-menu-item ${item.danger ? 'danger' : ''}`}
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// 导出按钮专用下拉组件
export function ExportDropdown({ onExport }: { onExport: (quality: string) => void }) {
  return (
    <Dropdown
      trigger={
        <button className="btn-capsule btn-primary">
          导出
          <ChevronDown size={14} />
        </button>
      }
      align="right"
      items={[
        {
          label: '高清 (1080p)',
          icon: (
            <span className="w-3 h-3 rounded-sm bg-neon-cyan opacity-60" />
          ),
          onClick: () => onExport('high'),
        },
        {
          label: '标清 (720p)',
          icon: (
            <span className="w-3 h-3 rounded-sm bg-text-secondary opacity-40" />
          ),
          onClick: () => onExport('medium'),
        },
        {
          label: '流畅 (480p)',
          icon: (
            <span className="w-3 h-3 rounded-sm bg-text-muted opacity-30" />
          ),
          onClick: () => onExport('low'),
        },
        { divider: true },
        {
          label: '自定义设置...',
          icon: null,
          onClick: () => onExport('custom'),
        },
      ]}
    />
  )
}

export default Dropdown
