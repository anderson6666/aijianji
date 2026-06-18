import React from 'react'
import {
  Trash2,
  GripVertical,
  Layers,
  Clock,
  Move,
  Maximize2,
  RotateCw,
  Eye,
  Volume2,
  Gauge,
} from 'lucide-react'
import useProjectStore from '@/store/useProjectStore'
import PropertyInput from './PropertyInput'

function PropertyPanel() {
  const clip = useProjectStore((s) => s.getSelectedClip())
  const updateClip = useProjectStore((s) => s.updateClip)
  const removeEffectFromClip = useProjectStore((s) => s.removeEffectFromClip)

  if (!clip) return null

  // 更新属性辅助函数
  const handleUpdate = (updates: Record<string, number | string>) => {
    Object.entries(updates).forEach(([key, val]) => {
      updateClip(clip.id, { [key]: val } as never)
    })
  }

  return (
    <div className="space-y-0">
      {/* 基本属性 */}
      <Section title="基本属性" icon={<Clock size={12} />}>
        <PropertyInput
          label="名称"
          type="text"
          value=""
          onChange={() => {}}
        />

        <PropertyInput
          label="开始时间"
          type="number"
          value={clip.startTime}
          min={0}
          max={9999}
          step={0.1}
          unit="秒"
          onChange={(v) => handleUpdate({ startTime: v })}
        />

        <PropertyInput
          label="持续时间"
          type="number"
          value={clip.duration}
          min={0.1}
          max={3600}
          step={0.1}
          unit="秒"
          onChange={(v) => handleUpdate({ duration: v })}
        />

        <PropertyInput
          label="速度"
          type="number"
          value={clip.speed}
          min={0.1}
          max={10}
          step={0.1}
          unit="x"
          onChange={(v) => handleUpdate({ speed: v })}
        />
      </Section>

      {/* 外观属性 */}
      <Section title="外观" icon={<Eye size={12} />}>
        <PropertyInput
          label="不透明度"
          type="number"
          value={clip.opacity}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => handleUpdate({ opacity: v })}
        />

        <PropertyInput
          label="音量"
          type="number"
          value={clip.volume}
          min={0}
          max={200}
          step={1}
          unit="%"
          onChange={(v) => handleUpdate({ volume: v })}
        />
      </Section>

      {/* 变换属性 */}
      <Section title="变换" icon={<Move size={12} />}>
        <PropertyInput
          label="位置 X"
          type="number"
          value={0}
          min={-2000}
          max={2000}
          step={1}
          unit="px"
          onChange={() => {}}
        />

        <PropertyInput
          label="位置 Y"
          type="number"
          value={0}
          min={-2000}
          max={2000}
          step={1}
          unit="px"
          onChange={() => {}}
        />

        <PropertyInput
          label="缩放"
          type="number"
          value={100}
          min={1}
          max={500}
          step={1}
          unit="%"
          onChange={() => {}}
        />

        <PropertyInput
          label="旋转"
          type="number"
          value={0}
          min={-360}
          max={360}
          step={1}
          unit="°"
          onChange={() => {}}
        />
      </Section>

      {/* 应用的效果列表 */}
      {clip.effects.length > 0 && (
        <Section title={`效果 (${clip.effects.length})`} icon={<Layers size={12} />}>
          <div className="space-y-1.5">
            {clip.effects.map((effect, index) => (
              <div
                key={effect.id}
                className="flex items-center gap-2 p-2 rounded-md group cursor-pointer hover:bg-cine-hover transition-colors"
              >
                <GripVertical
                  size={12}
                  className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style={{ cursor: 'grab' }}
                />
                <span className="flex-1 text-xs font-medium text-text-primary truncate">
                  {effect.type}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  #{index + 1}
                </span>
                <button
                  onClick={() => removeEffectFromClip(clip.id, effect.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon"
                  style={{ width: 22, height: 22 }}
                  title="删除效果"
                >
                  <Trash2 size={11} className="text-neon-magenta" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 无效果提示 */}
      {clip.effects.length === 0 && (
        <Section title="效果 (0)" icon={<Layers size={12} />}>
          <p className="text-[11px] text-text-muted text-center py-4">
            暂无效果 · 从左侧效果面板添加
          </p>
        </Section>
      )}
    </div>
  )
}

// 属性面板分组组件
function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="panel-section">
      <div className="panel-title flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export default PropertyPanel
