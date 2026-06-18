// ============ 效果类型枚举（6大类50种）============

export type EffectType =
  // 转场类 (12种)
  | 'hardCut'
  | 'fadeIn'
  | 'fadeOut'
  | 'dissolve'
  | 'flashWhite'
  | 'flashBlack'
  | 'wipe'
  | 'maskTransition'
  | 'matchCut'
  | 'jumpCut'
  | 'emptyShot'
  | 'flashbackTransition'
  // 画面特效类 (10种)
  | 'splitScreen'
  | 'pictureInPicture'
  | 'mirrorFlip'
  | 'rotate'
  | 'zoomPan'
  | 'freezeFrame'
  | 'reversePlay'
  | 'chromaKey'
  | 'maskCrop'
  | 'montageStitch'
  // 色彩光影类 (5种)
  | 'colorGrade'
  | 'monochrome'
  | 'vignette'
  | 'chromaticAberration'
  | 'grainNoise'
  // 音频剪辑类 (9种)
  | 'syncAV'
  | 'counterpointAV'
  | 'advanceAudio'
  | 'delayAudio'
  | 'audioFade'
  | 'beatSync'
  | 'silence'
  | 'reverb'
  | 'multiTrackStack'
  // 叙事剪辑类 (9种)
  | 'parallelMontage'
  | 'crossMontage'
  | 'contrastMontage'
  | 'metaphorMontage'
  | 'repeatEdit'
  | 'flashbackNarrative'
  | 'fastCut'
  | 'slowCut'
  | 'reverseChronology'
  // 创意特殊类 (5种)
  | 'glitch'
  | 'filmSimulation'
  | 'frameSkip'
  | 'textureOverlay'
  | 'textCardTransition'

// 效果分类
export type EffectCategory =
  | 'transition'
  | 'visual'
  | 'color'
  | 'audio'
  | 'narrative'
  | 'creative'

// 素材类型
export type MaterialType = 'video' | 'image' | 'audio'

// 素材接口
export interface Material {
  id: string
  name: string
  type: MaterialType
  url: string
  duration: number
  width?: number
  height?: number
  thumbnail?: string
}

// 关键帧
export interface Keyframe {
  time: number
  value: number
  easing?: string
}

// 已应用的效果
export interface AppliedEffect {
  id: string
  type: EffectType
  params: Record<string, number | string | boolean>
  keyframes: Keyframe[]
  startTime: number
  duration: number
}

// 片段/剪辑
export interface Clip {
  id: string
  materialId: string
  trackId: string
  startTime: number
  duration: number
  effects: AppliedEffect[]
  volume: number
  opacity: number
  speed: number
}

// 轨道
export interface Track {
  id: string
  name: string
  type: 'video' | 'audio' | 'effect'
  clips: Clip[]
  visible: boolean
  locked: boolean
  muted: boolean
}

// 项目
export interface Project {
  id: string
  name: string
  fps: number
  resolution: { width: number; height: number }
  tracks: Track[]
  materials: Material[]
  duration: number
}

// 参数定义
export interface ParamDef {
  key: string
  label: string
  type: 'slider' | 'color' | 'select' | 'toggle' | 'text'
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string | number }[]
}

// 效果定义元数据（用于效果面板展示）
export interface EffectDefinition {
  id: EffectType
  name: string
  category: EffectCategory
  categoryName: string
  icon: string
  description: string
  defaultParams: Record<string, number | string | boolean>
  paramDefs: ParamDef[]
}

// ============ 渲染引擎核心类型 ============

/** 变换参数 */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** 图层素材信息 */
export interface LayerSource {
  id: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  startTime: number;
  duration: number;
  transform?: Partial<Transform>;
  opacity?: number;
}

/** 图层实例 */
export interface Layer {
  id: string;
  source: LayerSource;
  transform: Transform;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

/** 图像效果处理函数签名（用于 EffectComposer） */
export type ImageEffectProcessor = (
  imageData: ImageData,
  params: Record<string, number>
) => ImageData;

/** 转场类型（简化版，用于 TransitionEngine） */
export type SimpleTransitionType =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'flashWhite'
  | 'flashBlack'
  | 'wipeLeft'
  | 'wipeRight'
  | 'wipeUp'
  | 'wipeDown'
  | 'mask'
  | 'matchCut'
  | 'jumpCut'
  | 'blackScreen'
  | 'flashback';

/** 转场配置 */
export interface TransitionConfig {
  type: SimpleTransitionType;
  duration: number;
  params?: Record<string, unknown>;
}

/** 导出选项 */
export interface ExportOptions {
  format: 'webm' | 'mp4';
  quality: 'low' | 'medium' | 'high';
  fps: number;
  width: number;
  height: number;
  audioBitrate?: number;
  videoBitrate?: number;
}

/** 导出进度回调 */
export type ProgressCallback = (progress: number) => void;

/** 导出状态 */
export type ExportStatus = 'idle' | 'exporting' | 'completed' | 'cancelled' | 'error';

/** 音频轨道（用于 AudioProcessor） */
export interface AudioTrack {
  id: string;
  url: string;
  volume: number;
  startTime: number;
  duration: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

/** 渲染帧信息 */
export interface RenderFrameInfo {
  time: number;
  width: number;
  height: number;
  layers: Layer[];
}
