/**
 * 叙事剪辑效果模块 - 9种高级编辑逻辑实现
 *
 * 这些是高级叙事性剪辑效果，影响时间轴上的片段排列和播放方式。
 * 每种效果导出配置对象，描述如何操作时间轴上的片段。
 *
 * 核心概念：
 * - 叙事效果不直接操作像素或音频节点
 * - 而是生成"时间轴编排指令"，由上层播放引擎执行
 * - 指令包括：片段重排、时长调整、转场插入、轨道分配等
 */

// ============ 类型定义 ============

/** 时间轴上的单个片段引用 */
export interface TimelineClipRef {
  /** 片段 ID */
  clipId: string;
  /** 所属轨道 ID */
  trackId: string;
  /** 原始起始时间 */
  originalStart: number;
  /** 原始持续时间 */
  originalDuration: number;
}

/** 时间轴编排指令 */
export interface TimelineInstruction {
  /** 指令类型 */
  type:
    | 'reorder'       // 重排片段顺序
    | 'duplicate'     // 复制片段
    | 'split'         // 分割片段
    | 'stretch'       // 拉伸/压缩时长
    | 'insert'        // 插入新片段/空镜头
    | 'overlay'       // 叠加层（画中画等）
    | 'transition'    // 插入转场
    | 'speedChange'   // 改变播放速度
    | 'effectApply'   // 应用视觉/音频效果
    | 'parallel'      // 并行播放多轨
    | 'group';        // 分组标记
  /** 涉及的片段列表 */
  clips: TimelineClipRef[];
  /** 指令参数 */
  params: Record<string, any>;
  /** 在时间轴上的目标位置 */
  targetTime?: number;
}

/** 叙事效果执行结果 */
export interface NarrativeResult {
  /** 效果名称 */
  effectName: string;
  /** 生成的编排指令序列 */
  instructions: TimelineInstruction[];
  /** 效果总持续时间（毫秒） */
  totalDuration: number;
  /** 元数据/描述信息 */
  metadata: Record<string, any>;
}

/** 叙事效果处理器函数类型 */
export type NarrativeEffectProcessor = (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
) => NarrativeResult;

/** 叙事效果注册表 */
export const narrativeEffects: Map<string, NarrativeEffectProcessor> = new Map();

// ============ 辅助函数 ============

function param(params: Record<string, any> | undefined, key: string, defaultValue: string, _min?: number, _max?: number): string;
function param(params: Record<string, any> | undefined, key: string, defaultValue: number, min?: number, max?: number): number;
function param(params: Record<string, any> | undefined, key: string, defaultValue: boolean, _min?: number, _max?: number): boolean;
function param(params: Record<string, any> | undefined, key: string, defaultValue: any, min?: number, max?: number): any {
  const value = params?.[key];
  if (value === undefined) return defaultValue;
  if (typeof defaultValue === 'number' && typeof value === 'number') {
    const clamped = min !== undefined ? Math.max(min, value) : value;
    return max !== undefined ? Math.min(max, clamped) : clamped;
  }
  if (typeof defaultValue === 'boolean') return Boolean(value);
  return value;
}

// ============ 9种叙事剪辑效果实现 ============

/**
 * 1. parallelMontage - 平行蒙太奇
 * 同时展现两个或多个并行发展的故事线
 * 将多个场景在不同轨道上同时播放，通过交叉剪辑建立联系
 */
narrativeEffects.set('parallelMontage', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const threadCount = param(params, 'threadCount', 2);
  const rhythm = param(params, 'rhythm', 'balanced');
  const crossCutInterval = param(params, 'crossCutInterval', 3000);

  // 将源片段按 threadCount 分配到不同线程
  const threads: TimelineClipRef[][] = Array.from({ length: threadCount }, () => []);
  sourceClips.forEach((clip, index) => {
    threads[index % threadCount].push(clip);
  });

  const instructions: TimelineInstruction[] = [];

  // 为每个线程创建并行播放指令
  threads.forEach((threadClips, threadIndex) => {
    instructions.push({
      type: 'parallel',
      clips: threadClips,
      params: {
        trackIndex: threadIndex,
        threadLabel: `线程${threadIndex + 1}`,
        rhythmMode: rhythm,
      },
    });
  });

  // 创建交叉切换指令
  if (crossCutInterval > 0 && threadCount > 1) {
    instructions.push({
      type: 'transition',
      clips: [],
      params: {
        transitionType: 'hardCut',
        interval: crossCutInterval,
        autoCrossCut: true,
      },
    });
  }

  // 计算总时长：取所有线程中最长的
  const totalDuration = Math.max(
    ...threads.map(t => t.reduce((sum, c) => sum + c.originalDuration, 0))
  );

  return {
    effectName: 'parallelMontage',
    instructions,
    totalDuration,
    metadata: {
      threadCount,
      rhythm,
      description: `${threadCount}条故事线平行发展`,
    },
  };
});

/**
 * 2. crossMontage - 交叉蒙太奇
 * 在不同时空场景间快速交替切换，建立紧张感和节奏感
 * 通过控制剪接频率和递进模式来营造情绪曲线
 */
narrativeEffects.set('crossMontage', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const cutFrequency = param(params, 'cutFrequency', 'fast');
  const buildTension = param(params, 'buildTension', true);
  const climaxPoint = param(params, 'climaxPoint', 0.75);

  // 根据剪接频率确定每个片段的目标时长
  const frequencyMap: Record<string, number> = {
    slow: 2000,
    medium: 1000,
    fast: 500,
    rapid: 200,
  };
  const targetClipDuration = frequencyMap[cutFrequency] || 1000;

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  // 如果需要递进紧张感，则逐渐缩短片段时长
  sourceClips.forEach((clip, index) => {
    let clipDuration = targetClipDuration;

    if (buildTension) {
      // 使用非线性加速曲线
      const progress = sourceClips.length > 1 ? index / (sourceClips.length - 1) : 0;
      const tensionFactor = progress < climaxPoint
        ? 1 - (progress / climaxPoint) * 0.6  // 高潮前加速缩短
        : 1 + ((progress - climaxPoint) / (1 - climaxPoint)) * 0.3; // 高潮后略微放缓
      clipDuration = Math.floor(targetClipDuration * tensionFactor);
    }

    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: {
        startTime: currentTime,
        duration: clipDuration,
        transitionIn: index > 0 ? { type: 'hardCut', duration: 50 } : null,
      },
      targetTime: currentTime,
    });

    currentTime += clipDuration;
  });

  return {
    effectName: 'crossMontage',
    instructions,
    totalDuration: currentTime,
    metadata: {
      cutFrequency,
      buildTension,
      climaxPoint,
      clipCount: sourceClips.length,
      description: `高频交替切换（${cutFrequency}）${buildTension ? '带递进紧张感' : ''}`,
    },
  };
});

/**
 * 3. contrastMontage - 对比蒙太奇
 * 并置两个截然不同的画面以突出主题差异
 * 支持：并置对比、前后对比、贫富对比、动静对比等模式
 */
narrativeEffects.set('contrastMontage', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const contrastType = param(params, 'contrastType', 'juxtaposition');
  const pairDuration = param(params, 'pairDuration', 2000);
  const repeatCount = param(params, 'repeatCount', 3);

  // 需要至少2个片段来形成对比对
  const pairedClips = sourceClips.length >= 2 ? sourceClips : [
    sourceClips[0] || { clipId: '_placeholder_a', trackId: '', originalStart: 0, originalDuration: pairDuration } as TimelineClipRef,
    { clipId: '_placeholder_b', trackId: '', originalStart: 0, originalDuration: pairDuration } as TimelineClipRef,
  ];

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  for (let round = 0; round < repeatCount; round++) {
    // A 面（第一组）
    instructions.push({
      type: 'reorder',
      clips: [pairedClips[0]],
      params: {
        startTime: currentTime,
        duration: pairDuration,
        label: contrastType === 'beforeAfter' ? '变化前' : `对比A-第${round + 1}轮`,
      },
      targetTime: currentTime,
    });

    // B 面（第二组）
    instructions.push({
      type: 'reorder',
      clips: [pairedClips.length > 1 ? pairedClips[1] : pairedClips[0]],
      params: {
        startTime: currentTime + pairDuration,
        duration: pairDuration,
        label: contrastType === 'beforeAfter' ? '变化后' : `对比B-第${round + 1}轮`,
      },
      targetTime: currentTime + pairDuration,
    });

    // 对比之间添加过渡（可选）
    if (round < repeatCount - 1) {
      instructions.push({
        type: 'transition',
        clips: [pairedClips[0], pairedClips[1]],
        params: {
          transitionType: 'dissolve',
          duration: 300,
          position: currentTime + pairDuration * 2 - 150,
        },
      });
    }

    currentTime += pairDuration * 2;
  }

  return {
    effectName: 'contrastMontage',
    instructions,
    totalDuration: currentTime,
    metadata: {
      contrastType,
      repeatCount,
      description: `${contrastType}对比 × ${repeatCount}次重复`,
    },
  };
});

/**
 * 4. metaphorMontage - 隐喻蒙太奇
 * 用象征性画面替代直接表达，传递深层含义
 * 通过视觉风格和桥接效果强化象征意义
 */
narrativeEffects.set('metaphorMontage', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const metaphorStrength = param(params, 'metaphorStrength', 0.7);
  const visualStyle = param(params, 'visualStyle', 'symbolic');
  const bridgeEffect = param(params, 'bridgeEffect', 'soft');

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  // 为每个片段应用隐喻风格的视觉处理
  sourceClips.forEach((clip, index) => {
    // 基础排列指令
    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: {
        startTime: currentTime,
        duration: clip.originalDuration,
        metaphorIndex: index,
      },
      targetTime: currentTime,
    });

    // 应用隐喻视觉风格
    instructions.push({
      type: 'effectApply',
      clips: [clip],
      params: {
        effectType: getMetaphorVisualEffect(visualStyle),
        intensity: metaphorStrength,
        style: visualStyle,
      },
      targetTime: currentTime,
    });

    // 片段间的桥接效果
    if (index < sourceClips.length - 1) {
      instructions.push({
        type: 'transition',
        clips: [clip, sourceClips[index + 1]],
        params: {
          transitionType: mapBridgeEffect(bridgeEffect),
          duration: 600,
        },
        targetTime: currentTime + clip.originalDuration - 300,
      });
    }

    currentTime += clip.originalDuration;
  });

  return {
    effectName: 'metaphorMontage',
    instructions,
    totalDuration: currentTime,
    metadata: {
      metaphorStrength,
      visualStyle,
      bridgeEffect,
      description: `${visualStyle}风格隐喻表达（强度${(metaphorStrength * 100).toFixed(0)}%）`,
    },
  };
});

/**
 * 5. repeatEdit - 重复剪辑
 * 重复播放同一动作或场景以强调情感或制造冲击力
 * 可选速度变化和音量衰减
 */
narrativeEffects.set('repeatEdit', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const repeatTimes = param(params, 'repeatTimes', 3);
  const interval = param(params, 'interval', 100);
  const speedChange = param(params, 'speedChange', 1.0);
  const decayVolume = param(params, 'decayVolume', false);

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  // 取第一个源片段作为重复对象
  const sourceClip = sourceClips[0];
  if (!sourceClip) {
    return {
      effectName: 'repeatEdit',
      instructions: [],
      totalDuration: 0,
      metadata: { error: '无可用片段' },
    };
  }

  const baseDuration = sourceClip.originalDuration;

  for (let i = 0; i < repeatTimes; i++) {
    // 计算当前重复的速度因子（可变）
    const currentSpeed = i === 0 ? 1.0 :
      (speedChange >= 1 ? 1 + (i / repeatTimes) * (speedChange - 1)
        : 1 - (i / repeatTimes) * (1 - speedChange));

    const adjustedDuration = baseDuration / currentSpeed;

    // 复制片段指令
    instructions.push({
      type: 'duplicate',
      clips: [sourceClip],
      params: {
        startTime: currentTime,
        duration: adjustedDuration,
        repeatIndex: i,
        speedFactor: currentSpeed,
      },
      targetTime: currentTime,
    });

    // 速度变化指令
    if (Math.abs(currentSpeed - 1.0) > 0.01) {
      instructions.push({
        type: 'speedChange',
        clips: [sourceClip],
        params: {
          speed: currentSpeed,
          applyTo: `repeat_${i}`,
        },
        targetTime: currentTime,
      });
    }

    // 音量衰减
    if (decayVolume && repeatTimes > 1) {
      const volumeFactor = 1 - (i / (repeatTimes - 1)) * 0.6;
      instructions.push({
        type: 'effectApply',
        clips: [sourceClip],
        params: {
          effectType: 'audioFade',
          volumeMultiplier: volumeFactor,
        },
        targetTime: currentTime,
      });
    }

    currentTime += adjustedDuration + interval;
  }

  return {
    effectName: 'repeatEdit',
    instructions,
    totalDuration: currentTime,
    metadata: {
      repeatTimes,
      speedChange,
      decayVolume,
      description: `重复播放 ${repeatTimes} 次${speedChange !== 1.0 ? `（变速 ${speedChange}x）` : ''}`,
    },
  };
});

/**
 * 6. flashbackNarrative - 闪回叙事
 * 从当前时态跳转到过去的某个时刻讲述前因后果
 * 带有独特的视觉风格变化（模糊、色彩偏移等）
 */
narrativeEffects.set('flashbackNarrative', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const depth = param(params, 'depth', 'single');
  const transitionStyle = param(params, 'transitionStyle', 'dreamy');
  const returnMarker = param(params, 'returnMarker', true);

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  // 当前时间线片段（正常叙事）
  const presentClips = sourceClips.slice(0, Math.ceil(sourceClips.length / 2));
  // 过去时间线片段（闪回内容）
  const pastClips = sourceClips.slice(Math.ceil(sourceClips.length / 2));

  // === 第一部分：当前时间线 ===
  presentClips.forEach((clip) => {
    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: { startTime: currentTime, timelineLayer: 'present' },
      targetTime: currentTime,
    });
    currentTime += clip.originalDuration;
  });

  // === 进入闪回的转场 ===
  instructions.push({
    type: 'transition',
    clips: presentClips.slice(-1).concat(pastClips.slice(0, 1)),
    params: {
      transitionType: mapFlashbackTransition(transitionStyle),
      duration: 1500,
      direction: 'forward',
    },
    targetTime: currentTime - 300,
  });

  // === 第二部分：闪回内容 ===
  pastClips.forEach((clip, index) => {
    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: {
        startTime: currentTime,
        timelineLayer: 'past',
        flashbackIndex: index,
      },
      targetTime: currentTime,
    });

    // 应用于闪回片段的视觉效果
    instructions.push({
      type: 'effectApply',
      clips: [clip],
      params: {
        effectType: 'flashbackTransition',
        blurAmount: 8,
        colorShift: true,
        intensity: 0.8,
      },
      targetTime: currentTime,
    });

    currentTime += clip.originalDuration;
  });

  // === 返回当前时间线的转场 ===
  if (returnMarker && pastClips.length > 0) {
    instructions.push({
      type: 'transition',
      clips: [pastClips.slice(-1)[0]],
      params: {
        transitionType: 'flashbackTransition',
        duration: 1200,
        direction: 'return',
        isReturnMarker: true,
      },
      targetTime: currentTime - 200,
    });
  }

  return {
    effectName: 'flashbackNarrative',
    instructions,
    totalDuration: currentTime,
    metadata: {
      depth,
      transitionStyle,
      returnMarker,
      hasPastContent: pastClips.length > 0,
      description: `${depth === 'nested' ? '嵌套' : depth === 'multiple' ? '多重' : '单层'}闪回（${transitionStyle}式转场）`,
    },
  };
});

/**
 * 7. fastCut - 快切
 * 高频短镜头快速连续切换，营造紧迫、兴奋或混乱的氛围
 * 通过极短的镜头时长和高频率切换实现
 */
narrativeEffects.set('fastCut', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const clipDuration = param(params, 'clipDuration', 200);
  const rampMode = param(params, 'rampMode', 'constant');
  const shakeIntensity = param(params, 'shakeIntensity', 0);

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  sourceClips.forEach((clip, index) => {
    // 根据 rampMode 调整当前片段时长
    let duration = clipDuration;

    switch (rampMode) {
      case 'speedUp': {
        // 加速模式：越来越短
        const progress = sourceClips.length > 1 ? index / (sourceClips.length - 1) : 0;
        duration = Math.max(80, Math.floor(clipDuration * (1 - progress * 0.7)));
        break;
      }
      case 'slowDown': {
        // 减速模式：开始极快后逐渐放慢
        const progress = sourceClips.length > 1 ? index / (sourceClips.length - 1) : 0;
        duration = Math.floor(clipDuration * (0.4 + progress * 0.6));
        break;
      }
      case 'wave': {
        // 波浪式：长短交替
        const wavePhase = Math.sin(index * 0.8) * 0.5 + 0.5;
        duration = Math.floor(clipDuration * (0.5 + wavePhase));
        break;
      }
      default:
        break;
    }

    // 快切片段指令
    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: {
        startTime: currentTime,
        duration,
        fastCutIndex: index,
        transitionIn: { type: 'hardCut', duration: 10 },
      },
      targetTime: currentTime,
    });

    // 抖动效果
    if (shakeIntensity > 0) {
      instructions.push({
        type: 'effectApply',
        clips: [clip],
        params: {
          effectType: 'transformShake',
          intensity: shakeIntensity,
          frequency: 15 + index % 5,
        },
        targetTime: currentTime,
      });
    }

    currentTime += duration;
  });

  return {
    effectName: 'fastCut',
    instructions,
    totalDuration: currentTime,
    metadata: {
      clipDuration,
      rampMode,
      shakeIntensity,
      clipCount: sourceClips.length,
      avgClipLength: Math.round(currentTime / sourceClips.length),
      description: `快切模式（平均${Math.round(currentTime / sourceClips.length)}ms/镜，${rampMode}节奏）`,
    },
  };
});

/**
 * 8. slowCut - 慢剪
 * 延长每个镜头的停留时间，让观众充分感受画面情绪
 * 通过延长镜头时长、可选呼吸效果和叠化过渡实现
 */
narrativeEffects.set('slowCut', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const holdMultiplier = param(params, 'holdMultiplier', 2.5);
  const breatheEffect = param(params, 'breatheEffect', true);
  const fadeOverlap = param(params, 'fadeOverlap', 300);

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  sourceClips.forEach((clip, index) => {
    // 延长后的片段时长
    const extendedDuration = clip.originalDuration * holdMultiplier;

    // 慢剪片段指令
    instructions.push({
      type: 'reorder',
      clips: [clip],
      params: {
        startTime: currentTime,
        duration: extendedDuration,
        slowCutIndex: index,
      },
      targetTime: currentTime,
    });

    // 呼吸效果：缓慢的缩放脉动
    if (breatheEffect) {
      instructions.push({
        type: 'effectApply',
        clips: [clip],
        params: {
          effectType: 'zoomPan',
          scaleStart: 1.0,
          scaleEnd: 1.05,
          panX: 2,
          panY: 1,
          cycleDuration: extendedDuration,
        },
        targetTime: currentTime,
      });
    }

    // 叠化重叠过渡
    if (fadeOverlap > 0 && index < sourceClips.length - 1) {
      instructions.push({
        type: 'transition',
        clips: [clip, sourceClips[index + 1]],
        params: {
          transitionType: 'dissolve',
          duration: fadeOverlap,
          position: currentTime + extendedDuration - fadeOverlap,
        },
        targetTime: currentTime + extendedDuration - fadeOverlap,
      });
    }

    // 减去重叠部分的净增加时间
    currentTime += extendedDuration - (index < sourceClips.length - 1 ? fadeOverlap : 0);
  });

  return {
    effectName: 'slowCut',
    instructions,
    totalDuration: currentTime,
    metadata: {
      holdMultiplier,
      breatheEffect,
      fadeOverlap,
      description: `慢剪模式（${holdMultiplier}x延时${breatheEffect ? '+呼吸效果' : ''}${fadeOverlap > 0 ? `+${fadeOverlap}ms叠化` : ''})`,
    },
  };
});

/**
 * 9. insertFlashback / reverseChronology - 插叙/倒叙
 * 非线性时间编排，将片段按非时间顺序重新组织
 * 支持多种非线性结构：插叙、倒叙、碎片化叙事
 */
narrativeEffects.set('reverseChronology', (
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult => {
  const mode = param(params, 'mode', 'reverse'); // reverse | flashback | fragmented
  const markerStyle = param(params, 'markerStyle', 'subtitle'); // subtitle | color | none

  const instructions: TimelineInstruction[] = [];
  let currentTime = 0;

  switch (mode) {
    case 'reverse': {
      // 纯倒叙：完全反转时间顺序
      const reversedClips = [...sourceClips].reverse();

      reversedClips.forEach((clip, index) => {
        instructions.push({
          type: 'reorder',
          clips: [clip],
          params: {
            startTime: currentTime,
            duration: clip.originalDuration,
            chronologicalIndex: sourceClips.length - 1 - index,
            timeLabel: formatTimeLabel(sourceClips.length - 1 - index, markerStyle),
          },
          targetTime: currentTime,
        });

        // 倒叙间使用叠化过渡
        if (index < reversedClips.length - 1) {
          instructions.push({
            type: 'transition',
            clips: [clip, reversedClips[index + 1]],
            params: {
              transitionType: 'dissolve',
              duration: 400,
            },
            targetTime: currentTime + clip.originalDuration - 200,
          });
        }

        currentTime += clip.originalDuration;
      });
      break;
    }

    case 'flashback': {
      // 插叙：在正常时间线中插入过去片段
      const midPoint = Math.floor(sourceClips.length / 2);
      const beforeClips = sourceClips.slice(0, midPoint);
      const insertedClips = sourceClips.slice(midPoint);

      // 先播放"现在"的部分
      beforeClips.forEach((clip) => {
        instructions.push({
          type: 'reorder',
          clips: [clip],
          params: {
            startTime: currentTime,
            timelinePosition: 'present',
          },
          targetTime: currentTime,
        });
        currentTime += clip.originalDuration;
      });

      // 插入"过去"的闪回
      instructions.push({
        type: 'transition',
        clips: [beforeClips.slice(-1)[0], insertedClips[0]],
        params: {
          transitionType: 'flashbackTransition',
          duration: 1200,
          label: '回忆开始...',
        },
        targetTime: currentTime - 200,
      });

      insertedClips.forEach((clip, index) => {
        instructions.push({
          type: 'reorder',
          clips: [clip],
          params: {
            startTime: currentTime,
            timelinePosition: 'past',
            flashbackLabel: `过去 · 第${index + 1}段`,
          },
          targetTime: currentTime,
        });

        // 闪回片段应用怀旧滤镜
        instructions.push({
          type: 'effectApply',
          clips: [clip],
          params: {
            effectType: 'monochrome',
            mode: 'sepia',
            intensity: 0.6,
          },
          targetTime: currentTime,
        });

        currentTime += clip.originalDuration;
      });

      // 返回标记
      instructions.push({
        type: 'insert',
        clips: [],
        params: {
          type: 'textCard',
          text: '回到现在',
          duration: 800,
          style: markerStyle,
        },
        targetTime: currentTime,
      });
      currentTime += 800;
      break;
    }

    case 'fragmented': {
      // 碎片化叙事：随机打乱但保持逻辑分组
      const groups = groupClipsForFragmented(sourceClips);
      const shuffledOrder = shuffleWithStructure(groups);

      shuffledOrder.forEach((group, groupIndex) => {
        group.clips.forEach((clip, clipIndex) => {
          instructions.push({
            type: 'reorder',
            clips: [clip],
            params: {
              startTime: currentTime,
              fragmentGroup: groupIndex,
              fragmentLabel: `碎片 ${String.fromCharCode(65 + groupIndex)}-${clipIndex + 1}`,
            },
            targetTime: currentTime,
          });
          currentTime += clip.originalDuration;
        });

        // 组间使用硬切分隔
        if (groupIndex < shuffledOrder.length - 1) {
          instructions.push({
            type: 'transition',
            clips: [],
            params: {
              transitionType: 'hardCut',
              duration: 100,
            },
            targetTime: currentTime,
          });
        }
      });
      break;
    }

    default:
      break;
  }

  return {
    effectName: 'reverseChronology',
    instructions,
    totalDuration: currentTime,
    metadata: {
      mode,
      markerStyle,
      description: getChronologyDescription(mode),
    },
  };
});

// ============ 内部辅助函数 ============

/** 根据视觉风格映射对应的特效类型 */
function getMetaphorVisualEffect(style: string): string {
  const map: Record<string, string> = {
    symbolic: 'monochrome',     // 象征式 → 单色化
    associative: 'colorGrade',  // 联想式 → 调色
    poetic: 'vignette',         // 诗意式 → 暗角
  };
  return map[style] || 'colorGrade';
}

/** 映射桥接效果到转场类型 */
function mapBridgeEffect(bridge: string): string {
  const map: Record<string, string> = {
    soft: 'dissolve',
    hard: 'hardCut',
    dissolve: 'dissolve',
  };
  return map[bridge] || 'dissolve';
}

/** 映射闪回转场风格 */
function mapFlashbackTransition(style: string): string {
  const map: Record<string, string> = {
    dreamy: 'flashbackTransition',
    abrupt: 'jumpCut',
    gradual: 'fadeIn',
  };
  return map[style] || 'flashbackTransition';
}

/** 格式化时间标签 */
function formatTimeLabel(index: number, style: string): string {
  switch (style) {
    case 'subtitle':
      return `时间点 ${index + 1}`;
    case 'color':
      return ''; // 用颜色编码代替文字
    default:
      return '';
  }
}

/** 获取时间编排描述 */
function getChronologyDescription(mode: string): string {
  const descriptions: Record<string, string> = {
    reverse: '完全倒序叙事',
    flashback: '插叙结构（现在→过去→现在）',
    fragmented: '碎片化非线性叙事',
  };
  return descriptions[mode] || '非线性时间编排';
}

/** 为碎片化模式分组片段 */
function groupClipsForFragmented(clips: TimelineClipRef[]): Array<{ clips: TimelineClipRef[] }> {
  const groupSize = Math.max(1, Math.ceil(clips.length / 4)); // 最多分4组
  const groups: Array<{ clips: TimelineClipRef[] }> = [];

  for (let i = 0; i < clips.length; i += groupSize) {
    groups.push({ clips: clips.slice(i, i + groupSize) });
  }

  return groups;
}

/** 保持内部结构的洗牌算法 */
function shuffleWithStructure<T>(array: T[]): T[] {
  const result = [...array];
  // Fisher-Yates 洗牌
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============ 导出便捷方法 ============

/**
 * 根据名称获取叙事效果处理器
 */
export function getNarrativeEffect(name: string): NarrativeEffectProcessor | undefined {
  return narrativeEffects.get(name);
}

/**
 * 执行指定的叙事效果
 */
export function applyNarrativeEffect(
  name: string,
  sourceClips: TimelineClipRef[],
  params?: Record<string, any>
): NarrativeResult | null {
  const processor = narrativeEffects.get(name);
  if (processor) {
    return processor(sourceClips, params);
  }
  console.warn(`[NarrativeEffects] 未知的叙事效果: ${name}`);
  return null;
}

/** 所有可用的叙事效果名称列表 */
export const narrativeEffectNames: string[] = [
  'parallelMontage', 'crossMontage', 'contrastMontage',
  'metaphorMontage', 'repeatEdit', 'flashbackNarrative',
  'fastCut', 'slowCut', 'reverseChronology'
];
