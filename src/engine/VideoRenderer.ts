import type { Layer, Transform, AppliedEffect, EffectType } from '../types';
import { EffectComposer } from './EffectComposer';
import { applyTransition, getTransition } from '../effects/transitions';
import { applyVisualEffect } from '../effects/visual';
import { applyColorEffect } from '../effects/color';
import { applyCreativeEffect } from '../effects/creative';
import useProjectStore from '../store/useProjectStore';

interface VideoSource {
  url: string;
  element: HTMLVideoElement;
  ready: boolean;
}

interface ImageSource {
  url: string;
  element: HTMLImageElement;
  ready: boolean;
}

/**
 * 视频渲染器 - 核心 Canvas 渲染引擎
 * 负责视频/图片素材的加载、变换和逐帧渲染，支持多图层合成
 */
export class VideoRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoSources: Map<string, VideoSource> = new Map();
  private imageSources: Map<string, ImageSource> = new Map();
  private currentTransform: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };
  private layers: Layer[] = [];
  private layerEffects: Map<string, AppliedEffect[]> = new Map(); // 每个图层的效果列表
  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;
  private onSourceReady?: () => void; // 素材加载就绪回调
  private effectComposer: EffectComposer; // 效果合成器

  // 音频相关：Canvas drawImage 不播放视频音频，需要通过 Web Audio API 输出
  private audioContext: AudioContext | null = null;
  private videoAudioNodes: Map<string, MediaElementAudioSourceNode> = new Map();
  private masterGain: GainNode | null = null;
  // 音频输出目标节点：用于将音频流注入 canvas.captureStream() 实现录屏带声音
  private audioDestination: MediaStreamAudioDestinationNode | null = null;

  /** 模块级共享引用：供 ExportDialog 获取音频流 */
  static sharedAudioStream: MediaStream | null = null;
  /** 模块级共享引用：供 ExportDialog 获取正确的预览画布（避免 querySelector 拿到其他 canvas） */
  static sharedCanvas: HTMLCanvasElement | null = null;

  // 效果分类：哪些效果走转场处理器、画面特效处理器、色彩处理器、创意处理器、EffectComposer
  // 转场效果（需要 fromImg + toImg，通过 transitions.ts 处理）
  private static readonly TRANSITION_EFFECTS = new Set([
    'hardCut', 'fadeIn', 'fadeOut', 'dissolve', 'flashWhite', 'flashBlack',
    'wipe', 'maskTransition', 'matchCut', 'emptyShot', 'flashbackTransition',
  ]);

  // 画面特效（通过 visual.ts 的 VisualEffectProcessor 处理，操作 ctx+canvas）
  private static readonly VISUAL_EFFECTS = new Set([
    'splitScreen', 'pictureInPicture', 'mirrorFlip', 'rotate',
    'zoomPan', 'freezeFrame', 'chromaKey',
    'maskCrop', 'slowMotion', 'fastMotion',
  ]);

  // 色彩光影效果（通过 color.ts 的 ColorEffectProcessor 处理）
  private static readonly COLOR_EFFECTS = new Set([
    'monochrome', 'vignette', 'chromaticAberration', 'grainNoise',
  ]);

  // 创意特殊效果（通过 creative.ts 的 CreativeEffectProcessor 处理）
  private static readonly CREATIVE_EFFECTS = new Set([
    'glitch', 'filmSimulation', 'frameSkip', 'textureOverlay', 'textCardTransition',
  ]);

  // 速度效果（影响视频播放速率，在 renderLayer 时间映射阶段处理）
  private static readonly SPEED_EFFECTS = new Set([
    'slowMotion', 'fastMotion',
  ]);

  // EffectComposer 内部类型映射（用于像素级处理的效果）
  private static readonly EFFECT_COMPOSER_MAP: Record<string, string> = {
    monochrome: 'grayscale',
    vignette: 'vignette',
    grainNoise: 'noise',
    chromaticAberration: 'chromaticAberration',
    glitch: 'glitch',
    chromaKey: 'chromaKey',
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 渲染上下文');
    }
    this.ctx = ctx;
    this.effectComposer = new EffectComposer();
    VideoRenderer.sharedCanvas = this.canvas;

    // 初始化音频上下文，用于输出视频原生音频
    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.audioContext.destination);

      // 创建音频输出目标节点，用于录屏时捕获音频
      this.audioDestination = this.audioContext.createMediaStreamDestination();
      this.masterGain.connect(this.audioDestination);
      VideoRenderer.sharedAudioStream = this.audioDestination.stream;
    } catch {
      // 音频不可用时静默失败
      this.audioContext = null;
    }
  }

  /** 恢复音频上下文（浏览器自动播放策略需要用户交互后调用） */
  resumeAudio(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * 播放所有视频的音频（配合 Canvas 逐帧渲染使用）
   * 修复：仅播放已就绪的视频，未就绪的注册一次性监听器等待就绪后自动播放
   */
  playAudio(): void {
    this.resumeAudio();
    const state = useProjectStore?.getState?.();
    const currentTime = state?.currentTime ?? 0;

    for (const [url, source] of this.videoSources.entries()) {
      const video = source.element;
      if (source.ready && video.paused) {
        // 已就绪：同步 currentTime 后播放
        if (Math.abs(video.currentTime - currentTime) > 0.05) {
          video.currentTime = Math.max(0, currentTime);
        }
        video.play().catch(() => { /* 静默 */ });
      } else if (!source.ready) {
        // 未就绪：注册一次性 canplay 监听，就绪后自动播放
        const onCanPlay = () => {
          source.ready = true;
          video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('loadeddata', onCanPlay);
          if (this.audioContext?.state === 'suspended') {
            this.resumeAudio();
          }
          const currentState = useProjectStore?.getState?.();
          if (currentState?.isPlaying) {
            if (Math.abs(video.currentTime - (currentState.currentTime ?? 0)) > 0.05) {
              video.currentTime = Math.max(0, currentState.currentTime ?? 0);
            }
            video.play().catch(() => { /* 静默 */ });
          }
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
        video.addEventListener('loadeddata', onCanPlay, { once: true });
      }
    }
  }

  /**
   * 暂停所有视频音频
   */
  pauseAudio(): void {
    for (const source of this.videoSources.values()) {
      source.element.pause();
    }
  }

  /**
   * 设置主音量（0-100）
   */
  setVolume(volumePercent: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volumePercent / 100));
    }
  }

  /** 设置素材就绪回调（任一素材可播放时触发） */
  setOnSourceReady(callback: () => void): void {
    this.onSourceReady = callback;
  }

  /**
   * 加载视频素材到隐藏的 video 元素中
   * 增强容错：检测 blob URL 失效、自动清理失败资源、支持重新加载
   */
  async loadVideo(url: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('渲染器已销毁');
    }

    // 如果已有同URL的加载中的source，先清理（避免重复加载导致ERR_ABORTED）
    const existing = this.videoSources.get(url);
    if (existing) {
      // 检查现有video是否仍然有效（blob URL可能因页面刷新失效）
      try {
        // 尝试访问video的状态来探测URL是否有效
        if (existing.element.src !== url) {
          existing.element.src = ''; // 清除无效src
        }
      } catch {
        // 跨域或其他异常，忽略
      }
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      video.playsInline = true;

      // 设置超时：如果视频长时间无法加载，reject而不是挂起
      const timeoutId = setTimeout(() => {
        console.warn(`[VideoRenderer] 视频加载超时: ${url.substring(0, 50)}...`);
        // 不reject，让后续渲染跳过即可
        resolve();
      }, 15000);

      video.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        this.videoSources.set(url, { url, element: video, ready: false });

        // 将视频音频连接到 Web Audio API 输出（Canvas drawImage 不播放声音）
        if (this.audioContext && !this.videoAudioNodes.has(url)) {
          try {
            const sourceNode = this.audioContext.createMediaElementSource(video);
            sourceNode.connect(this.masterGain!);
            this.videoAudioNodes.set(url, sourceNode);
          } catch {
            // 已连接或其他错误时忽略（可能重复连接）
          }
        }

        // 等到可以播放时标记就绪
        video.oncanplay = () => {
          const existing = this.videoSources.get(url);
          if (existing) {
            existing.ready = true;
            this.onSourceReady?.();
          }
        };
        // 如果已经可以播放（缓存命中），立即触发
        if (video.readyState >= 2) {
          const existing = this.videoSources.get(url);
          if (existing) {
            existing.ready = true;
            this.onSourceReady?.();
          }
        }
        resolve();
      };

      video.onerror = (e) => {
        clearTimeout(timeoutId);
        console.error(`[VideoRenderer] 视频加载失败: ${url.substring(0, 50)}...`, e);
        // 标记为不可用但不阻止其他功能
        this.videoSources.set(url, { url, element: video, ready: false });
        // resolve而非reject，让渲染器继续工作（只是这个视频源不显示）
        resolve();
      };

      video.onabort = () => {
        clearTimeout(timeoutId);
        console.warn(`[VideoRenderer] 视频加载被中断(abort): ${url.substring(0, 50)}...`);
        // blob URL 失效等情况下会触发 abort
        resolve();
      };

      video.src = url;
      video.load(); // 显式触发加载
    });
  }

  /**
   * 加载图片素材
   */
  async loadImage(url: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('渲染器已销毁');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this.imageSources.set(url, { url, element: img, ready: true });
        this.onSourceReady?.();
        resolve();
      };

      img.onerror = () => {
        reject(new Error(`加载图片失败: ${url}`));
      };

      img.src = url;
    });
  }

  /**
   * 根据当前时间渲染对应帧
   * @param time 当前播放时间（秒）
   */
  renderFrame(time: number): void {
    if (this.isDestroyed) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    // 清空画布并填充黑色背景（确保淡入淡出效果有正确的黑底）
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.save();

    // 应用全局变换
    this.applyGlobalTransform(width, height);

    // 按 zIndex 排序并渲染所有图层
    const sortedLayers = [...this.layers]
      .filter(layer => layer.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      this.renderLayer(layer, time);
    }

    this.ctx.restore();
  }

  /**
   * 清空画布（填充黑色背景）
   */
  clear(): void {
    if (this.isDestroyed) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 设置全局变换参数
   */
  setTransform(x: number, y: number, scale: number, rotation: number): void {
    this.currentTransform = { x, y, scale, rotation };
  }

  /**
   * 获取当前视频元素（如果有）
   */
  getVideoElement(): HTMLVideoElement | null {
    if (this.videoSources.size === 0) return null;
    const firstSource = this.videoSources.values().next().value;
    return firstSource?.element ?? null;
  }

  /**
   * 添加图层
   */
  addLayer(layer: Layer): void {
    this.layers.push(layer);
  }

  /**
   * 移除图层
   */
  removeLayer(layerId: string): void {
    this.layers = this.layers.filter(l => l.id !== layerId);
  }

  /**
   * 更新图层属性
   */
  updateLayer(layerId: string, updates: Partial<Layer>): void {
    const index = this.layers.findIndex(l => l.id === layerId);
    if (index !== -1) {
      this.layers[index] = { ...this.layers[index], ...updates };
    }
  }

  /**
   * 清除所有图层
   */
  clearLayers(): void {
    this.layers = [];
    this.layerEffects.clear();
  }

  /**
   * 设置图层效果
   */
  setLayerEffects(layerId: string, effects: AppliedEffect[]): void {
    this.layerEffects.set(layerId, effects);
  }

  /**
   * 销毁渲染器，释放资源
   */
  destroy(): void {
    this.isDestroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 停止并释放所有视频源
    for (const source of this.videoSources.values()) {
      source.element.pause();
      source.element.src = '';
      source.element.load();
    }
    this.videoSources.clear();

    // 断开音频节点
    for (const node of this.videoAudioNodes.values()) {
      try { node.disconnect(); } catch { /* ignore */ }
    }
    this.videoAudioNodes.clear();

    // 关闭音频上下文
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => { /* ignore */ });
    }
    this.audioContext = null;
    this.masterGain = null;
    this.audioDestination = null;
    VideoRenderer.sharedAudioStream = null;
    VideoRenderer.sharedCanvas = null;

    // 清除图片源引用
    this.imageSources.clear();
    this.layers = [];
  }

  /**
   * 应用全局变换
   */
  private applyGlobalTransform(width: number, height: number): void {
    const { x, y, scale, rotation } = this.currentTransform;

    this.ctx.translate(width / 2 + x, height / 2 + y);
    this.ctx.rotate((rotation * Math.PI) / 180);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-width / 2, -height / 2);
  }

  /**
   * 渲染单个图层
   */
  private renderLayer(layer: Layer, time: number): void {
    const { source, transform, opacity: baseOpacity } = layer;
    const relativeTime = time - source.startTime;

    // 检查时间范围
    if (relativeTime < 0 || relativeTime > source.duration) {
      return;
    }

    // 获取该图层的效果列表，筛选出当前时间范围内激活的效果
    const allEffects = this.layerEffects.get(layer.id) ?? [];
    const activeEffects = allEffects.filter(
      (effect) => relativeTime >= effect.startTime && relativeTime < effect.startTime + effect.duration
    );

    // 使用 TRANSITION_EFFECTS Set 分离转场效果和普通图像效果
    const transitionEffects = activeEffects.filter(e =>
      VideoRenderer.TRANSITION_EFFECTS.has(e.type)
    );
    // 分离速度效果（影响视频时间映射，不参与像素处理）
    const speedEffects = activeEffects.filter(e =>
      VideoRenderer.SPEED_EFFECTS.has(e.type)
    );
    const imageEffects = activeEffects.filter(e =>
      !VideoRenderer.TRANSITION_EFFECTS.has(e.type) &&
      !VideoRenderer.SPEED_EFFECTS.has(e.type)
    );

    // 计算当前激活的速度因子（取最后一个匹配速度效果的速率）
    let speedFactor = 1.0;
    if (speedEffects.length > 0) {
      const lastSpeedEffect = speedEffects[speedEffects.length - 1];
      speedFactor = (lastSpeedEffect.params.rate as number) ?? 1.0;
    }

    // 通过 computeTransitionState 统一计算所有12种转场的状态
    const { opacityMultiplier, flashOverlay, clipPath } = this.computeTransitionState(transitionEffects, relativeTime);

    // 调试日志：仅在有效果时输出
    if (allEffects.length > 0 && activeEffects.length === 0 && Math.abs(relativeTime) < 10) {
      console.log('[VideoRenderer] 效果未激活', {
        layerId: layer.id,
        relativeTime: relativeTime.toFixed(3) + 's',
        allEffects: allEffects.map(e => ({
          type: e.type,
          start: e.startTime.toFixed(3) + 's',
          end: (e.startTime + e.duration).toFixed(3) + 's',
        })),
      })
    }
    if (activeEffects.length > 0) {
      console.log('[VideoRenderer] 效果已激活', {
        layerId: layer.id,
        relativeTime: relativeTime.toFixed(3) + 's',
        activeEffects: activeEffects.map(e => ({ type: e.type, params: e.params })),
        opacityMultiplier,
        flashOverlay,
      })
    }

    this.ctx.save();
    this.ctx.globalAlpha = baseOpacity * opacityMultiplier;

    // 如果有 clipPath（wipe/maskTransition/matchCut/jumpCut），设置裁剪区域
    if (clipPath) {
      clipPath(this.ctx, this.canvas.width, this.canvas.height);
      this.ctx.clip();
    }

    // 应用图层变换
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.ctx.translate(centerX + transform.x, centerY + transform.y);
    this.ctx.rotate((transform.rotation * Math.PI) / 180);
    this.ctx.scale(transform.scale, transform.scale);

    switch (source.type) {
      case 'video':
        this.renderVideoSource(source.url, relativeTime, speedFactor);
        break;
      case 'image':
        this.renderImageSource(source.url);
        break;
    }

    // 如果有激活的图像效果（非转场），应用处理（传入速度因子使动画同步响应）
    if (imageEffects.length > 0) {
      this.applyLayerEffects(imageEffects, relativeTime, speedFactor);
    }

    // 恢复到 save 时的状态（清除变换），用屏幕坐标绘制全屏闪光
    this.ctx.restore();

    // 如果有闪光叠加效果，使用 save/restore transform 方式绘制全屏
    if (flashOverlay && flashOverlay.alpha > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = flashOverlay.alpha * baseOpacity;
      this.ctx.fillStyle = flashOverlay.color;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }
  }

  /**
   * 计算所有转场效果的统一状态（透明度、闪光叠加、裁剪路径）
   * 处理全部12种转场效果
   */
  private computeTransitionState(
    effects: AppliedEffect[],
    relativeTime: number
  ): {
    opacityMultiplier: number;
    flashOverlay: { color: string; alpha: number } | null;
    clipPath: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null;
  } {
    let opacityMultiplier = 1.0;
    let flashOverlay: { color: string; alpha: number } | null = null;
    let clipPath: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null = null;

    for (const effect of effects) {
      const progress = Math.max(0, Math.min(1, (relativeTime - effect.startTime) / effect.duration));

      switch (effect.type) {
        case 'hardCut':
          // 硬切：在切换点产生1帧白色闪烁作为视觉标记
          if (progress > 0.45 && progress < 0.55) {
            flashOverlay = { color: '#FFFFFF', alpha: 0.3 };
          }
          break;

        case 'fadeIn':
          // 淡入：从完全透明到完全不透明
          opacityMultiplier = Math.max(0, Math.min(1, progress));
          break;

        case 'fadeOut':
          // 淡出：从完全不透明到完全透明
          opacityMultiplier = Math.max(0, Math.min(1, 1 - progress));
          break;

        case 'dissolve':
          // 溶解/叠化：透明度平滑过渡
          opacityMultiplier = Math.max(0, Math.min(1, 1 - progress));
          break;

        case 'flashWhite': {
          // 闪白：白色闪光快速闪烁（钟形曲线）
          const intensity = (effect.params.intensity as number) ?? 1.0;
          const flashCurve = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
          flashOverlay = { color: '#FFFFFF', alpha: flashCurve * intensity };
          break;
        }

        case 'flashBlack': {
          // 闪黑：黑色快速闪过（钟形曲线）
          const intensity = (effect.params.intensity as number) ?? 1.0;
          const flashCurve = progress < 0.5 ? progress * 2 : 1 - (progress - 0.5) * 2;
          flashOverlay = { color: '#000000', alpha: flashCurve * intensity };
          break;
        }

        case 'wipe': {
          // 划像：根据 direction 参数设置矩形裁剪区域
          const direction = (effect.params.direction as string) ?? 'left';
          clipPath = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            ctx.beginPath();
            switch (direction) {
              case 'left':
                ctx.rect(0, 0, w * progress, h);
                break;
              case 'right':
                ctx.rect(w * (1 - progress), 0, w * progress, h);
                break;
              case 'top':
                ctx.rect(0, 0, w, h * progress);
                break;
              case 'bottom':
                ctx.rect(0, h * (1 - progress), w, h * progress);
                break;
              default:
                ctx.rect(0, 0, w, h);
            }
            ctx.closePath();
          };
          break;
        }

        case 'maskTransition': {
          // 遮罩转场：根据 shape 参数设置形状裁剪区域
          const shape = (effect.params.shape as string) ?? 'circle';
          clipPath = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            const cx = w / 2;
            const cy = h / 2;
            const maxRadius = Math.sqrt(cx * cx + cy * cy);
            const currentRadius = maxRadius * progress;
            ctx.beginPath();
            switch (shape) {
              case 'circle':
                ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
                break;
              case 'square': {
                const size = Math.min(w, h) * progress;
                ctx.rect(cx - size / 2, cy - size / 2, size, size);
                break;
              }
              case 'star':
                this.drawStarPath(ctx, cx, cy, currentRadius, currentRadius * 0.4, 5);
                break;
              case 'diamond':
                this.drawDiamondPath(ctx, cx, cy, currentRadius);
                break;
              default:
                ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
            }
            ctx.closePath();
          };
          break;
        }

        case 'matchCut': {
          // 匹配剪辑：快速切换 + 微缩放脉动 + 白色闪光标记
          const scalePulse = 1 + Math.sin(progress * Math.PI) * 0.015;
          clipPath = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
            const cx = w / 2;
            const cy = h / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(scalePulse, scalePulse);
            ctx.translate(-cx, -cy);
            ctx.beginPath();
            ctx.rect(-2, -2, w + 4, h + 4);
            ctx.closePath();
            ctx.restore();
          };
          if (progress > 0.4 && progress < 0.6) {
            const flashIntensity = 1 - Math.abs(progress - 0.5) * 5;
            flashOverlay = { color: '#FFFFFF', alpha: flashIntensity * 0.15 };
          }
          break;
        }

        case 'emptyShot': {
          // 空镜：三阶段透明度（淡出→保持纯色→淡入）
          const firstHalf = progress < 0.5;
          if (firstHalf) {
            opacityMultiplier = 1 - progress * 2;
          } else {
            opacityMultiplier = (progress - 0.5) * 2;
          }
          break;
        }

        case 'flashbackTransition': {
          // 闪回转场：脉动透明度 + 暖色闪光叠加
          // opacity 呈现脉动效果（正弦波）
          const pulse = 0.7 + 0.3 * Math.sin(progress * Math.PI * 3);
          opacityMultiplier = pulse;
          // 暖色闪光（琥珀色调）
          const warmthIntensity = Math.sin(progress * Math.PI) * 0.3;
          if (warmthIntensity > 0.01) {
            flashOverlay = { color: '#FFAA44', alpha: warmthIntensity };
          }
          break;
        }
      }
    }

    return { opacityMultiplier, flashOverlay, clipPath };
  }

  /**
   * 绘制星形路径（用于 maskTransition 的 star 形状）
   */
  private drawStarPath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    points: number
  ): void {
    const step = Math.PI / points;
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + i * step;
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    ctx.closePath();
  }

  /**
   * 绘制菱形路径（用于 maskTransition 的 diamond 形状）
   */
  private drawDiamondPath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number
  ): void {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius, cy);
    ctx.lineTo(cx, cy + radius);
    ctx.lineTo(cx - radius, cy);
    ctx.closePath();
  }

  /**
   * 对当前 canvas 内容应用效果
   * 按效果分类派发到对应的处理器（visual/color/creative/composer/音频/叙事）
   * @param effects 激活的效果列表
   * @param relativeTime 当前相对时间，用于计算动画进度
   * @param speedFactor 速度因子，用于调整动画进度（加速/减速时画面特效同步响应）
   */
  private applyLayerEffects(effects: AppliedEffect[], relativeTime: number, speedFactor: number = 1.0): void {
    // ===== 关键修复：重置画布变换到单位矩阵 =====
    // renderLayer 在绘制图层时设置了 translate/rotate/scale 变换
    // 所有画面特效/色彩/创意处理器都假设 context 处于(0,0)无变换状态
    // 如果不重置，处理器内部的 translate/rotate/drawImage 会与已有变换叠加
    // 导致画面偏移（典型症状：图像复制到右下角）
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 音频效果集合
    const AUDIO_EFFECTS = new Set([
      'syncAV', 'counterpointAV', 'advanceAudio', 'delayAudio',
      'audioFade', 'beatSync', 'silence', 'reverb', 'multiTrackStack',
    ]);

    // 叙事效果集合
    const NARRATIVE_EFFECTS = new Set([
      'parallelMontage', 'crossMontage', 'contrastMontage', 'metaphorMontage',
      'repeatEdit', 'flashbackNarrative', 'fastCut', 'slowCut', 'reverseChronology',
    ]);

    // 需要动画进度的效果类型
    const ANIMATED_EFFECTS = new Set([
      'zoomPan', 'freezeFrame', 'frameSkip', 'textCardTransition',
      'mirrorFlip', 'rotate',
    ]);

    for (const effect of effects) {
      try {
        // 计算动画进度（用于需要时间参数的效果）
        // 速度因子影响动画时间流逝：加速时动画更快完成，减速时更慢
        let paramsWithProgress = { ...effect.params };
        if (ANIMATED_EFFECTS.has(effect.type) && effect.duration > 0) {
          const progress = ((relativeTime - effect.startTime) * speedFactor) / effect.duration;
          paramsWithProgress = { ...effect.params, progress: Math.max(0, Math.min(1, progress)) };
        }

        if (VideoRenderer.VISUAL_EFFECTS.has(effect.type)) {
          // 画面特效 → VisualEffectProcessor
          applyVisualEffect(effect.type, this.ctx, this.canvas, paramsWithProgress);
        } else if (VideoRenderer.COLOR_EFFECTS.has(effect.type)) {
          // 色彩光影效果 → ColorEffectProcessor
          applyColorEffect(effect.type, this.ctx, this.canvas, effect.params);
        } else if (VideoRenderer.CREATIVE_EFFECTS.has(effect.type)) {
          // 创意特殊效果 → CreativeEffectProcessor
          applyCreativeEffect(effect.type, this.ctx, this.canvas, paramsWithProgress);
        } else if (VideoRenderer.EFFECT_COMPOSER_MAP[effect.type]) {
          // EffectComposer 像素处理管线（fallback）
          const internalType = VideoRenderer.EFFECT_COMPOSER_MAP[effect.type];
          const width = this.canvas.width;
          const height = this.canvas.height;
          const imageData = this.ctx.getImageData(0, 0, width, height);

          // 提取数值参数
          const numericParams: Record<string, number> = {};
          for (const [key, value] of Object.entries(effect.params)) {
            if (typeof value === 'number') {
              numericParams[key] = value;
            }
          }
          this.fillDefaultParams(effect.type, internalType, effect.params, numericParams);

          const processed = this.effectComposer.composeEffects(
            [{ ...effect, type: internalType as EffectType, params: numericParams }],
            imageData
          );
          this.ctx.putImageData(processed, 0, 0);
        } else if (AUDIO_EFFECTS.has(effect.type)) {
          // 音频效果 → 由 AudioProcessor 处理
          console.log(`[VideoRenderer] 音频效果 "${effect.type}" 已在音频引擎中处理`);
        } else if (NARRATIVE_EFFECTS.has(effect.type)) {
          // 叙事效果 → 由时间轴编排引擎处理
          console.log(`[VideoRenderer] 叙事效果 "${effect.type}" 已在时间轴编排引擎中处理`);
        } else if (VideoRenderer.SPEED_EFFECTS.has(effect.type)) {
          // 速度效果 → 已在 renderLayer 时间映射阶段处理
        } else {
          console.warn(`[VideoRenderer] 效果类型 "${effect.type}" 暂无对应的渲染处理器，已跳过`);
        }
      } catch (err) {
        console.warn(`[VideoRenderer] 效果 "${effect.type}" 处理失败:`, err);
      }
    }

    // 恢复画布变换（renderLayer 的 restore 会处理剩余状态）
    this.ctx.restore();
  }

  /**
   * 根据效果类型填充 EffectComposer 需要的默认参数
   * 主要服务于 EFFECT_COMPOSER_MAP 中的 fallback 效果
   * 注意：colorGrade 等多参数色彩效果应走 COLOR_EFFECTS 分支（color.ts），不走此方法
   */
  private fillDefaultParams(
    originalType: string,
    _internalType: string,
    originalParams: Record<string, number | string | boolean>,
    numericParams: Record<string, number>
  ): void {
    switch (originalType) {
      case 'monochrome': {
        // 黑白：grayscale amount
        // 定义中 intensity 范围 0-1 → 处理器期望 0-100
        const intensity = (originalParams.intensity as number) ?? 1.0;
        numericParams.amount = intensity * 100; // 转换为 0-100 范围
        break;
      }
      case 'vignette': {
        // 暗角：定义用 amount(0-1)/radius(0-1)/softness(0-1)
        // 处理器期望 strength(0-100)
        const amount = (originalParams.amount as number) ?? 0.5;
        numericParams.strength = amount * 100; // 转换为 0-100 范围
        break;
      }
      case 'grainNoise': {
        // 噪点：定义中 intensity 范围 0-1 → 处理器期望 0-100
        const intensity = (originalParams.intensity as number) ?? 0.15;
        numericParams.intensity = intensity * 100; // 放大到可见范围
        break;
      }
      case 'filmSimulation': {
        // 胶片模拟：sepia
        // grainIntensity 范围 0-1 → sepia amount 0-100
        const grainIntensity = (originalParams.grainIntensity as number) ?? 0.2;
        numericParams.amount = Math.min(100, grainIntensity * 500);
        break;
      }
      case 'chromaticAberration': {
        // 色差：定义中 offset(px), angle(deg), radial(bool)
        // 处理器期望 offset(像素级)
        numericParams.offset = (originalParams.offset as number) ?? 4;
        numericParams.angle = (originalParams.angle as number) ?? 0;
        break;
      }
      case 'glitch': {
        // 故障艺术：定义中 intensity(0-1), rgbSplit(px), scanlines(bool), noiseAmount(0-1)
        numericParams.intensity = ((originalParams.intensity as number) ?? 0.6) * 100;
        numericParams.rgbSplit = (originalParams.rgbSplit as number) ?? 8;
        break;
      }
      case 'chromaKey': {
        // 绿幕抠像：定义中 targetColor(#hex), threshold(0-100), edgeSoftness(0-20)
        numericParams.threshold = (originalParams.threshold as number) ?? 40;
        numericParams.edgeSoftness = (originalParams.edgeSoftness as number) ?? 2;
        break;
      }
      case 'invert': {
        numericParams.amount = 100;
        break;
      }
    }
  }

  /**
   * 渲染视频源
   * @param speedFactor 速度因子，1.0=正常，<1=慢速，>1=快速
   */
  private renderVideoSource(url: string, time: number, speedFactor: number = 1.0): void {
    const source = this.videoSources.get(url);
    if (!source || !source.ready) return;

    const video = source.element;
    if (video.readyState < 2) return; // 双重检查

    // 根据速度因子计算实际视频时间
    const mediaTime = speedFactor !== 1.0
      ? this.computeMediaTime(time, speedFactor)
      : time;

    // 设置当前时间
    if (Math.abs(video.currentTime - mediaTime) > 0.05) {
      video.currentTime = Math.max(0, mediaTime);
    }

    const drawWidth = this.canvas.width;
    const drawHeight = this.canvas.height;

    // 保持宽高比绘制
    this.drawAspectFit(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  }

  /**
   * 根据速度因子计算媒体时间
   * @param time 时间轴时间（秒）
   * @param rate 播放速率（<1=慢速/减速，>1=快速/加速，如0.5x半速、2.0x二倍速）
   */
  private computeMediaTime(time: number, rate: number): number {
    return time * Math.max(0.01, rate);
  }

  /**
   * 渲染图片源
   */
  private renderImageSource(url: string): void {
    const source = this.imageSources.get(url);
    if (!source) return;

    const img = source.element;
    const drawWidth = this.canvas.width;
    const drawHeight = this.canvas.height;

    this.drawAspectFit(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  }

  /**
   * 保持宽高比绘制（类似 object-fit: contain）
   */
  private drawAspectFit(
    source: HTMLVideoElement | HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void {
    const srcWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const srcHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    const sourceRatio = srcWidth / srcHeight;
    const targetRatio = dw / dh;

    let finalDw: number;
    let finalDh: number;
    let finalDx: number;
    let finalDy: number;

    if (sourceRatio > targetRatio) {
      finalDw = dw;
      finalDh = dw / sourceRatio;
      finalDx = dx;
      finalDy = dy + (dh - finalDh) / 2;
    } else {
      finalDh = dh;
      finalDw = dh * sourceRatio;
      finalDx = dx + (dw - finalDw) / 2;
      finalDy = dy;
    }

    this.ctx.drawImage(source, finalDx, finalDy, finalDw, finalDh);
  }
}
