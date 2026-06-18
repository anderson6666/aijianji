import React, { useState, useCallback, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ParamDef } from '@/types'
import Tooltip from '@/components/Common/Tooltip'

interface EffectParamsEditorProps {
  paramDefs: ParamDef[]
  defaultParams: Record<string, number | string | boolean>
  /** 参数变更回调，将编辑后的参数回传给父组件 */
  onParamsChange?: (params: Record<string, number | string | boolean>) => void
}

function EffectParamsEditor({ paramDefs, defaultParams, onParamsChange }: EffectParamsEditorProps) {
  // 本地参数状态（从默认值初始化）
  const [params, setParams] = useState<Record<string, number | string | boolean>>({
    ...defaultParams,
  })

  // 更新单个参数
  const updateParam = useCallback(
    (key: string, value: number | string | boolean) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value }
        onParamsChange?.(next)
        return next
      })
    },
    [onParamsChange]
  )

  // 重置为默认值
  const resetToDefault = useCallback(() => {
    const resetParams = { ...defaultParams }
    setParams(resetParams)
    onParamsChange?.(resetParams)
  }, [defaultParams, onParamsChange])

  // 初始化时通知父组件默认参数
  useEffect(() => {
    onParamsChange?.(params)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (paramDefs.length === 0) return null

  return (
    <div className="space-y-3">
      {/* 重置按钮 */}
      <div className="flex items-center justify-end">
        <Tooltip content="重置为默认值">
          <button
            onClick={resetToDefault}
            className="flex items-center gap-1 text-[11px] text-text-muted hover:text-neon-cyan transition-colors bg-transparent border-none cursor-pointer"
          >
            <RotateCcw size={12} />
            重置
          </button>
        </Tooltip>
      </div>

      {/* 渲染每个参数控件 */}
      {paramDefs.map((def) => (
        <ParamControl
          key={def.key}
          def={def}
          value={params[def.key]}
          onChange={(val) => updateParam(def.key, val)}
        />
      ))}
    </div>
  )
}

// 单个参数控件渲染器
function ParamControl({
  def,
  value,
  onChange,
}: {
  def: ParamDef
  value: number | string | boolean
  onChange: (value: number | string | boolean) => void
}) {
  switch (def.type) {
    case 'slider':
      return (
        <div className="property-input-group">
          <label className="property-label">{def.label}</label>
          <div className="property-row">
            <input
              type="number"
              value={Number(value)}
              min={def.min}
              max={def.max}
              step={def.step || 1}
              onChange={(e) => onChange(Number(e.target.value))}
              className="property-number-input"
            />
            <input
              type="range"
              value={Number(value)}
              min={def.min}
              max={def.max}
              step={def.step || 1}
              onChange={(e) => onChange(Number(e.target.value))}
              className="property-slider"
            />
          </div>
        </div>
      )

    case 'color':
      return (
        <div className="property-input-group">
          <label className="property-label">{def.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-none p-0.5"
              style={{ background: 'transparent' }}
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

    case 'select':
      return (
        <div className="property-input-group">
          <label className="property-label">{def.label}</label>
          <select
            value={String(value)}
            onChange={(e) => {
              const opt = def.options?.find(
                (o) => String(o.value) === e.target.value
              )
              onChange(opt?.value ?? e.target.value)
            }}
            className="input-dark w-full text-xs rounded-md appearance-none cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238888a0' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 8px center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '16px',
              paddingRight: '28px',
            }}
          >
            {def.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )

    case 'toggle':
      return (
        <div className="flex items-center justify-between py-1">
          <label className="property-label mb-0">{def.label}</label>
          <button
            onClick={() => onChange(!Boolean(value))}
            className={`toggle-switch ${Boolean(value) ? 'active' : ''}`}
          >
            <div className="toggle-switch-knob" />
          </button>
        </div>
      )

    case 'text':
      return (
        <div className="property-input-group">
          <label className="property-label">{def.label}</label>
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="input-dark w-full text-xs rounded-md"
            placeholder={`输入${def.label}...`}
          />
        </div>
      )

    default:
      return null
  }
}

export default EffectParamsEditor
