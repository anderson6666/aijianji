/**
 * 视频编辑器效果系统 - 统一导出入口
 *
 * 本模块聚合导出6大类共50种效果实现：
 *
 * ┌─────────────────┬────────┬──────────────────────────────┐
 * │ 类别             │ 数量   │ 文件                         │
 * ├─────────────────┼────────┼──────────────────────────────┤
 * │ 转场效果         │ 12种   │ transitions.ts              │
 * │ 画面特效         │ 10种   │ visual.ts                    │
 * │ 色彩光影         │ 5种    │ color.ts                     │
 * │ 音频剪辑         │ 9种    │ audio.ts                     │
 * │ 叙事剪辑         │ 9种    │ narrative.ts                 │
 * │ 创意特殊         │ 5种    │ creative.ts                  │
 * ├─────────────────┼────────┼──────────────────────────────┤
 * │ 合计            │ 50种   │                              │
 * └─────────────────┴────────┴──────────────────────────────┘
 */

// ============ 转场效果 (12种) ============
export {
  transitions,
  type TransitionProcessor,
  getTransition,
  applyTransition,
  transitionNames,
} from './transitions';

// ============ 画面特效 (10种) ============
export {
  visualEffects,
  type VisualEffectProcessor,
  getVisualEffect,
  applyVisualEffect,
  visualEffectNames,
} from './visual';

// ============ 色彩光影 (5种) ============
export {
  colorEffects,
  type ColorEffectProcessor,
  getColorEffect,
  applyColorEffect,
  colorEffectNames,
} from './color';

// ============ 音频剪辑 (9种) ============
export {
  audioEffects,
  type AudioEffectDefinition,
  type IAudioProcessor,
  getAudioEffect,
  applyAudioEffect,
  audioEffectNames,
} from './audio';

// ============ 叙事剪辑 (9种) ============
export {
  narrativeEffects,
  type NarrativeResult,
  type TimelineInstruction,
  type TimelineClipRef,
  type NarrativeEffectProcessor,
  getNarrativeEffect,
  applyNarrativeEffect,
  narrativeEffectNames,
} from './narrative';

// ============ 创意特殊 (5种) ============
export {
  creativeEffects,
  type CreativeEffectProcessor,
  getCreativeEffect,
  applyCreativeEffect,
  creativeEffectNames,
} from './creative';

// ============ 统一查询接口 ============

import { transitions as _transitions } from './transitions';
import { visualEffects as _visual } from './visual';
import { colorEffects as _color } from './color';
import { audioEffects as _audio } from './audio';
import { narrativeEffects as _narrative } from './narrative';
import { creativeEffects as _creative } from './creative';

/** 所有效果的分类枚举 */
export const EffectCategory = {
  transition: 'transition',
  visual: 'visual',
  color: 'color',
  audio: 'audio',
  narrative: 'narrative',
  creative: 'creative',
} as const;

export type EffectCategoryType = (typeof EffectCategory)[keyof typeof EffectCategory];

/**
 * 效果注册表总览 - 按类别索引所有可用效果
 */
export const effectRegistry: Record<string, {
  category: EffectCategoryType;
  processor: unknown;
}> = {};

// 注册转场效果
_transitions.forEach((_, name) => {
  effectRegistry[name] = { category: 'transition', processor: name };
});

// 注册画面特效
_visual.forEach((_, name) => {
  effectRegistry[name] = { category: 'visual', processor: name };
});

// 注册色彩效果
_color.forEach((_, name) => {
  effectRegistry[name] = { category: 'color', processor: name };
});

// 注册音频效果
_audio.forEach((_, name) => {
  effectRegistry[name] = { category: 'audio', processor: name };
});

// 注册叙事效果
_narrative.forEach((_, name) => {
  effectRegistry[name] = { category: 'narrative', processor: name };
});

// 注册创意效果
_creative.forEach((_, name) => {
  effectRegistry[name] = { category: 'creative', processor: name };
});

/**
 * 检查指定名称的效果是否存在
 */
export function hasEffect(name: string): boolean {
  return name in effectRegistry;
}

/**
 * 获取指定效果的类别
 */
export function getEffectCategory(name: string): EffectCategoryType | null {
  return effectRegistry[name]?.category ?? null;
}

/**
 * 获取所有已注册效果的名称列表（按类别分组）
 */
export function getAllEffectNamesByCategory(): Record<EffectCategoryType, string[]> {
  return {
    transition: Array.from(_transitions.keys()),
    visual: Array.from(_visual.keys()),
    color: Array.from(_color.keys()),
    audio: Array.from(_audio.keys()),
    narrative: Array.from(_narrative.keys()),
    creative: Array.from(_creative.keys()),
  };
}

/** 总效果数量统计 */
export const TOTAL_EFFECT_COUNT =
  _transitions.size +
  _visual.size +
  _color.size +
  _audio.size +
  _narrative.size +
  _creative.size;
