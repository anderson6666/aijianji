// 视频编辑器渲染引擎核心模块 - 统一导出

export { VideoRenderer } from './VideoRenderer';
export { AudioProcessor } from './AudioProcessor';
export { EffectComposer } from './EffectComposer';
export { TransitionEngine } from './TransitionEngine';
export { Exporter } from './Exporter';

// 重新导出类型定义，方便外部使用
export type {
  Transform,
  LayerSource,
  Layer,
  ImageEffectProcessor,
  SimpleTransitionType,
  TransitionConfig,
  ExportOptions,
  ProgressCallback,
  ExportStatus,
  AudioTrack,
  RenderFrameInfo,
} from '../types';
