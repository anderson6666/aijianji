import React, { useState, useCallback, useRef } from 'react'

interface PropertyInputProps {
  label: string
  type: 'number' | 'text' | 'color' | 'select'
  value: number | string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: { label: string; value: string | number }[]
  onChange: (value: number | string) => void
}

function PropertyInput({
  label,
  type,
  value,
  min,
  max,
  step = 1,
  unit,
  options,
  onChange,
}: PropertyInputProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragStartX = useRef(0)
  const dragStartVal = useRef(0)

  // Ctrl+拖拽微调（仅数字类型）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (type !== 'number') return
      if (!e.ctrlKey && !e.metaKey) return

      e.preventDefault()
      setIsDragging(true)
      dragStartX.current = e.clientX
      dragStartVal.current = Number(value)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - dragStartX.current
        const sensitivity = e.shiftKey ? 0.01 : 0.1
        const newVal = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, dragStartVal.current + delta * sensitivity))
        onChange(newVal)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [type, value, min, max, onChange]
  )

  const dragRef = useRef({ startX: 0, startVal: 0 })

  if (type === 'number') {
    return (
      <div className="property-input-group">
        <label className="property-label">{label}</label>
        <div className="property-row">
          <input
            type="number"
            value={Number(value).toFixed(step < 1 ? 2 : 0)}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseDown={handleMouseDown}
            className={`property-number-input ${isDragging ? 'cursor-ew-resize' : ''}`}
            style={{
              cursor: isDragging ? 'ew-resize' : undefined,
              borderColor: isDragging ? 'var(--accent-cyan)' : undefined,
            }}
          />
          <input
            type="range"
            value={Number(value)}
            min={min ?? 0}
            max={max ?? 100}
            step={step}
            onChange={(e) => onChange(Number(e.target.value))}
            className="property-slider"
          />
          {unit && <span className="property-unit">{unit}</span>}
        </div>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div className="property-input-group">
        <label className="property-label">{label}</label>
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="input-dark w-full text-xs rounded-md"
        />
      </div>
    )
  }

  if (type === 'color') {
    return (
      <div className="property-input-group">
        <label className="property-label">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-none p-0.5 bg-transparent"
          />
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="property-number-input flex-1 font-mono uppercase"
          />
        </div>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div className="property-input-group">
        <label className="property-label">{label}</label>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="input-dark w-full text-xs rounded-md appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238888a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 8px center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '16px',
            paddingRight: '28px',
          }}
        >
          {options?.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return null
}

export default PropertyInput
