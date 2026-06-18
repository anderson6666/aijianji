/**
 * 音频剪辑效果模块 - 9种音频处理实现
 *
 * 每种效果导出配置对象:
 * { name, description, apply(audioProcessor, params): void, defaultParams }
 *
 * 这些效果返回音频处理参数配置，由 AudioProcessor 执行实际的 Web Audio API 操作
 */

// ============ 类型定义 ============

/** AudioProcessor 实例的简化接口（解耦依赖） */
export interface IAudioProcessor {
  setVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  applyFadeIn(duration: number): void;
  applyFadeOut(duration: number): void;
  applyReverb(mix: number): Promise<void>;
  getCurrentTime(): number;
  seek(time: number): void;
}

/** 音频效果定义 */
export interface AudioEffectDefinition {
  /** 效果唯一标识 */
  id: string;
  /** 效果显示名称 */
  name: string;
  /** 效果描述 */
  description: string;
  /** 默认参数 */
  defaultParams: Record<string, any>;
  /**
   * 应用效果到音频处理器
   * @param processor 音频处理器实例
   * @param params 效果参数
   */
  apply(processor: IAudioProcessor, params?: Record<string, any>): void | Promise<void>;
}

/** 音频效果注册表 */
export const audioEffects: Map<string, AudioEffectDefinition> = new Map();

// ============ 9种音频剪辑效果实现 ============

/**
 * 1. syncAV - 声画同步
 * 确保音频轨道与视频画面严格时间对齐
 * 通过微调音频播放偏移量实现精确同步
 */
audioEffects.set('syncAV', {
  id: 'syncAV',
  name: '音画同步',
  description: '确保音频轨道与视频画面严格同步对齐，支持自动或手动偏移校正',
  defaultParams: {
    offset: 0,        // 偏移量（毫秒），负值=音频提前，正值=音频滞后
    autoAlign: true,  // 是否启用自动对齐检测
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const offset = params?.offset ?? 0;

    if (offset !== 0) {
      // 将毫偏移转换为秒并调整播放位置
      const currentPos = processor.getCurrentTime();
      const newPos = Math.max(0, currentPos + offset / 1000);
      processor.seek(newPos);
    }
  },
});

/**
 * 2. counterpointAV - 声画对位（声画对立）
 * 故意让音频与画面产生节奏上的错位，形成艺术反差张力
 * 通过延迟/提前音频播放来创造不协调感
 */
audioEffects.set('counterpointAV', {
  id: 'counterpointAV',
  name: '声画对立',
  description: '故意让音画产生节奏上的错位，形成反差张力，常用于实验性剪辑',
  defaultParams: {
    delayMs: 200,       // 延迟量（毫秒）
    invertRhythm: false, // 是否反转节奏感（交替提前/滞后）
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const delayMs = params?.delayMs ?? 200;
    const invertRhythm = params?.invertRhythm ?? false;

    if (invertRhythm) {
      // 反转模式：根据当前时间的奇偶性交替偏移
      const currentTime = processor.getCurrentTime();
      const beatPhase = (currentTime % (delayMs / 1000)) / (delayMs / 1000);
      const effectiveDelay = beatPhase < 0.5 ? -delayMs : delayMs;
      const newPos = Math.max(0, processor.getCurrentTime() + effectiveDelay / 1000);
      processor.seek(newPos);
    } else {
      // 标准延迟模式
      const newPos = Math.max(0, processor.getCurrentTime() + delayMs / 1000);
      processor.seek(newPos);
    }
  },
});

/**
 * 3. advanceAudio - 超前音（音频提前于画面）
 * 将音频相对于画面提前播放，营造预知感或紧张氛围
 * 可选边缘淡化避免突兀的音频切入
 */
audioEffects.set('advanceAudio', {
  id: 'advanceAudio',
  name: '音频提前',
  description: '将音频相对于画面提前播放，营造预知感或紧张氛围',
  defaultParams: {
    advanceMs: 500,   // 提前量（毫秒）
    fadeEdge: true,   // 边缘淡化（平滑过渡）
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const advanceMs = params?.advanceMs ?? 500;
    const fadeEdge = params?.fadeEdge ?? true;

    // 计算新的播放位置（音频提前 = 减少播放位置）
    const newPos = Math.max(0, processor.getCurrentTime() - advanceMs / 1000);

    if (fadeEdge && advanceMs > 50) {
      // 先淡入再跳转，避免突兀
      processor.applyFadeIn(Math.min(0.3, advanceMs / 2000));
    }

    processor.seek(newPos);
  },
});

/**
 * 4. delayAudio - 滞后音（音频滞后于画面）
 * 将音频相对于画面延迟播放，创造"慢半拍"的效果
 * 常用于喜剧、回忆或梦幻场景
 */
audioEffects.set('delayAudio', {
  id: 'delayAudio',
  name: '音频延迟',
  description: '将音频相对于画面延迟播放，创造"慢半拍"的效果',
  defaultParams: {
    delayMs: 500,     // 延迟量（毫秒）
    fadeEdge: true,   // 边缘淡化
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const delayMs = params?.delayMs ?? 500;
    const fadeEdge = params?.fadeEdge ?? true;

    // 计算新的播放位置（音频延迟 = 增加播放位置）
    const newPos = processor.getCurrentTime() + delayMs / 1000;

    if (fadeEdge && delayMs > 50) {
      // 先淡出再跳转
      processor.applyFadeOut(Math.min(0.3, delayMs / 2000));
    }

    processor.seek(newPos);
  },
});

/**
 * 5. audioFade - 音频淡入淡出
 * 使用 GainNode 控制音量的平滑渐入渐出
 * 支持多种曲线类型：线性、缓入缓出、指数
 */
audioEffects.set('audioFade', {
  id: 'audioFade',
  name: '音频淡入淡出',
  description: '平滑地调整音频音量的渐入渐出，支持多种曲线类型',
  defaultParams: {
    fadeIn: 500,           // 淡入时长（毫秒）
    fadeOut: 500,          // 淡出时长（毫秒）
    curve: 'easeInOut',    // 曲线类型
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const fadeIn = (params?.fadeIn ?? 500) / 1000; // 转换为秒
    const fadeOut = (params?.fadeOut ?? 500) / 1000;
    const curve = params?.curve ?? 'easeInOut';

    // 根据曲线类型应用不同的淡入策略
    switch (curve) {
      case 'linear':
        // 线性淡入（直接使用 linearRampToValueAtTime）
        if (fadeIn > 0) processor.applyFadeIn(fadeIn);
        break;

      case 'exponential':
        // 指数曲线（更自然的听觉感受）
        // 由于 Web Audio API 的 exponentialRamp 不能从 0 开始，
        // 这里使用较短的线性淡入模拟指数起始段
        if (fadeIn > 0.05) {
          processor.setVolume(0.001); // 接近零但不为零
          processor.applyFadeIn(fadeIn * 0.8);
        }
        break;

      case 'easeInOut':
      default:
        // 缓入缓出（默认行为）
        if (fadeIn > 0) processor.applyFadeIn(fadeIn);
        break;
    }

    // 预设淡出将在结束触发时调用
    // 这里记录淡出参数供外部使用
    (processor as Record<string, any>).__pendingFadeOut = fadeOut;
  },
});

/**
 * 6. beatSync - 音效卡点（节拍同步）
 * 基于节拍检测的自动剪切点标记
 * 根据 BPM 和灵敏度计算每个节拍的时间点
 */
audioEffects.set('beatSync', {
  id: 'beatSync',
  name: '节拍同步',
  description: '根据音乐节拍自动标记剪切点，实现精准节奏剪辑',
  defaultParams: {
    bpm: 120,            // 节拍速度（每分钟拍数）
    sensitivity: 0.8,    // 检测灵敏度 (0.1~1.0)
    autoCut: false,      // 是否自动执行剪切
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const bpm = params?.bpm ?? 120;
    const sensitivity = params?.sensitivity ?? 0.8;
    const autoCut = params?.autoCut ?? false;

    // 计算每拍的间隔时间（秒）
    const beatInterval = 60 / bpm;

    // 当前播放时间
    const currentTime = processor.getCurrentTime();

    // 计算当前所在的拍子索引
    const currentBeatIndex = Math.floor(currentTime / beatInterval);

    // 计算距离下一拍的时间
    const timeToNextBeat = (currentBeatIndex + 1) * beatInterval - currentTime;

    // 在每拍时刻添加轻微的音量脉冲（增强节奏感）
    if (timeToNextBeat < 0.05 && sensitivity > 0.5) {
      // 接近节拍点时略微提升音量
      const pulseGain = 1 + (sensitivity - 0.5) * 0.15;
      processor.setVolume(pulseGain);
    }

    // 存储节拍信息供 UI 层使用
    (processor as Record<string, any>).__beatInfo = {
      bpm,
      beatInterval,
      currentBeatIndex,
      timeToNextBeat,
      sensitivity,
      autoCut,
    };
  },
});

/**
 * 7. silence - 静音留白
 * 将指定时间段内的音频完全静音或降低至极低电平
 * 支持三种模式：完全静音、降噪模式、门限模式
 */
audioEffects.set('silence', {
  id: 'silence',
  name: '静音',
  description: '将指定时间段内的音频完全静音或降低至极低，营造节奏呼吸空间',
  defaultParams: {
    mode: 'mute',     // 静音模式: mute | reduce | gate
    floorDb: -60,     // 底噪水平（分贝）
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const mode = params?.mode ?? 'mute';
    const floorDb = params?.floorDb ?? -60;

    switch (mode) {
      case 'mute':
        // 完全静音
        processor.setVolume(0);
        break;

      case 'reduce': {
        // 降噪模式：降低到指定分贝水平
        // dB 转换为线性增益: gain = 10^(dB/20)
        const linearGain = Math.pow(10, floorDb / 20);
        processor.setVolume(linearGain);
        break;
      }

      case 'gate': {
        // 门限模式：仅在信号低于门限时静音
        // 此处简化为降低到很低水平（完整实现需要实时分析器节点）
        const linearGain = Math.pow(10, floorDb / 20);
        processor.setVolume(linearGain);
        break;
      }

      default:
        break;
    }

    // 记录原始音量以便恢复
    (processor as Record<string, any>).__preSilenceVolume = 1.0;
  },
});

/**
 * 8. reverb - 人声混响
 * 为音频添加空间感和环境回声效果
 * 使用 ConvolverNode 或 DelayNode 反馈网络
 * 支持可调参数：房间大小、衰减时间、混合比、预延迟
 */
audioEffects.set('reverb', {
  id: 'reverb',
  name: '混响',
  description: '为音频添加空间感和环境回声效果，模拟不同空间的声学特性',
  defaultParams: {
    roomSize: 0.5,    // 房间大小 (0~1)
    decay: 1.5,       // 衰减时间（秒）
    wetMix: 0.3,      // 湿声混合比 (0~1, 0=全干声, 1=全湿声)
    preDelay: 20,     // 预延迟（毫秒）
  },

  async apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const roomSize = params?.roomSize ?? 0.5;
    const decay = params?.decay ?? 1.5;
    const wetMix = params?.wetMix ?? 0.3;
    const preDelay = params?.preDelay ?? 20;

    // 根据房间大小和衰减时间计算最终混响混合比
    // 大房间 + 长衰减 → 更强的混响感
    let finalWetMix = wetMix;

    if (roomSize > 0.7 && decay > 2) {
      finalWetMix = Math.min(1, wetMix * 1.3); // 大厅堂效果增强
    } else if (roomSize < 0.3 && decay < 0.8) {
      finalWetMix = wetMix * 0.6; // 小房间效果减弱
    }

    // 应用混响效果
    await processor.applyReverb(finalWetMix);

    // 存储混响配置供后续调整
    (processor as Record<string, any>).__reverbConfig = {
      roomSize,
      decay,
      wetMix: finalWetMix,
      preDelay,
    };
  },
});

/**
 * 9. multiTrackStack - 多音轨堆叠（多层音频混合控制）
 * 将多个音频层混合叠加，支持独立控制各层参数
 * 支持多种混合模式：正常、加法、乘法
 */
audioEffects.set('multiTrackStack', {
  id: 'multiTrackStack',
  name: '多轨叠加',
  description: '将多个音频层混合叠加，支持独立控制各层音量和混合模式',
  defaultParams: {
    layerCount: 3,         // 层数 (2/3/4/6)
    mixMode: 'normal',     // 混合模式: normal | additive | multiply
    masterGain: 1.0,       // 主增益 (0~2)
  },

  apply(processor: IAudioProcessor, params?: Record<string, any>) {
    const layerCount = params?.layerCount ?? 3;
    const mixMode = params?.mixMode ?? 'normal';
    const masterGain = params?.masterGain ?? 1.0;

    // 设置主增益
    processor.setVolume(masterGain);

    // 根据混合模式调整各层相对音量
    switch (mixMode) {
      case 'normal':
        // 正常混合：各层均等音量
        for (let i = 0; i < layerCount; i++) {
          const trackId = `track_${i}`;
          processor.setTrackVolume(trackId, 1 / Math.sqrt(layerCount));
        }
        break;

      case 'additive': {
        // 加法混合：各层音量叠加，需要降低单层音量防止削波
        const perLayerGain = 1 / layerCount;
        for (let i = 0; i < layerCount; i++) {
          const trackId = `track_${i}`;
          processor.setTrackVolume(trackId, perLayerGain);
        }
        break;
      }

      case 'multiply': {
        // 乘法混合：仅保留各层的共同部分（通过大幅降低音量模拟）
        const perLayerGain = 0.5 / layerCount;
        for (let i = 0; i < layerCount; i++) {
          const trackId = `track_${i}`;
          processor.setTrackVolume(trackId, perLayerGain);
        }
        break;
      }

      default:
        break;
    }

    // 存储多轨配置
    (processor as Record<string, any>).__multiTrackConfig = {
      layerCount,
      mixMode,
      masterGain,
    };
  },
});

// ============ 导出便捷方法 ============

/**
 * 根据名称获取音频效果定义
 */
export function getAudioEffect(name: string): AudioEffectDefinition | undefined {
  return audioEffects.get(name);
}

/**
 * 执行指定的音频效果
 */
export async function applyAudioEffect(
  name: string,
  processor: IAudioProcessor,
  params?: Record<string, any>
): Promise<boolean> {
  const effectDef = audioEffects.get(name);
  if (effectDef) {
    await effectDef.apply(processor, params);
    return true;
  }
  console.warn(`[AudioEffects] 未知的音频效果: ${name}`);
  return false;
}

/** 所有可用的音频效果名称列表 */
export const audioEffectNames: string[] = [
  'syncAV', 'counterpointAV', 'advanceAudio', 'delayAudio',
  'audioFade', 'beatSync', 'silence', 'reverb', 'multiTrackStack'
];
