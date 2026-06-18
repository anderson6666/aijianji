/**
 * 转场效果模块 - 12种转场实现
 *
 * 每个转场函数签名:
 * (ctx: CanvasRenderingContext2D, fromImg: HTMLImageElement | ImageData | null,
 *  toImg: HTMLImageElement | ImageData | null, progress: number,
 *  width: number, height: number, params?: Record<string, any>) => void
 *
 * progress 范围: 0 ~ 1
 */

// ============ 类型定义 ============

/** 转场处理函数类型 */
export type TransitionProcessor = (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => void;

/** 转场效果注册表 */
export const transitions: Map<string, TransitionProcessor> = new Map();

// ============ 辅助函数 ============

/**
 * 将 ImageData 绘制到 Canvas 上
 */
function drawImageData(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData | null,
  x: number = 0,
  y: number = 0
): void {
  if (imageData) {
    ctx.putImageData(imageData, x, y);
  }
}

/**
 * 将 HTMLImageElement 绘制到 Canvas 上（填满指定区域）
 */
function drawImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number = 0,
  y: number = 0,
  w?: number,
  h?: number
): void {
  if (img) {
    ctx.drawImage(img, x, y, w ?? img.width, h ?? img.height);
  }
}

/**
 * 将 from/to 图像统一绘制（兼容 ImageData 和 HTMLImageElement）
 */
function drawFromTo(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | ImageData | null,
  x: number = 0,
  y: number = 0,
  w?: number,
  h?: number
): void {
  if (!source) return;
  if (source instanceof ImageData) {
    ctx.putImageData(source, x, y);
  } else {
    ctx.drawImage(source, x, y, w ?? source.width, h ?? source.height);
  }
}

// ============ 12种转场效果实现 ============

/**
 * 1. hardCut - 硬切 / 瞬间切换
 * progress > 0.5 时直接切换到目标帧，无任何过渡
 */
transitions.set('hardCut', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  _width: number,
  _height: number
) => {
  if (progress < 0.5) {
    drawFromTo(ctx, fromImg);
  } else {
    drawFromTo(ctx, toImg);
  }
});

/**
 * 2. fadeIn - 淡入
 * 从透明渐变到不透明（alpha 0→1），通常用于开场或段落起始
 */
transitions.set('fadeIn', (
  ctx: CanvasRenderingContext2D,
  _fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  // 先填充黑色背景
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // 目标帧以渐增的 alpha 叠加
  ctx.globalAlpha = Math.max(0, Math.min(1, progress));
  drawFromTo(ctx, toImg);
  ctx.globalAlpha = 1;
});

/**
 * 3. fadeOut - 淡出
 * 从不透明渐变到透明（alpha 1→0），通常用于结尾或段落收束
 */
transitions.set('fadeOut', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  _toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  _params?: Record<string, any>
) => {
  // 原始帧以递减的 alpha 显示
  ctx.globalAlpha = Math.max(0, Math.min(1, 1 - progress));
  drawFromTo(ctx, fromImg);
  ctx.globalAlpha = 1;

  // 底层黑色背景逐渐显现
  ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
  ctx.fillRect(0, 0, width, height);
});

/**
 * 4. dissolve - 溶解/叠化
 * 两帧交叉淡化叠加：from alpha 1→0, to alpha 0→1
 * 使用像素级混合实现平滑过渡
 */
transitions.set('dissolve', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const direction = params?.direction || 'horizontal';

  // 如果两个源都是 ImageData，使用像素级混合获得更高质量
  if (fromImg instanceof ImageData && toImg instanceof ImageData) {
    const result = new ImageData(width, height);
    const fromPixels = fromImg.data;
    const toPixels = toImg.data;
    const resultPixels = result.data;

    for (let i = 0; i < fromPixels.length; i += 4) {
      resultPixels[i]     = fromPixels[i] + (toPixels[i] - fromPixels[i]) * progress;
      resultPixels[i + 1] = fromPixels[i + 1] + (toPixels[i + 1] - fromPixels[i + 1]) * progress;
      resultPixels[i + 2] = fromPixels[i + 2] + (toPixels[i + 2] - fromPixels[i + 2]) * progress;
      resultPixels[i + 3] = 255;
    }
    ctx.putImageData(result, 0, 0);
  } else {
    // 回退到 canvas alpha 混合模式
    ctx.globalAlpha = 1 - progress;
    drawFromTo(ctx, fromImg);
    ctx.globalAlpha = progress;
    drawFromTo(ctx, toImg);
    ctx.globalAlpha = 1;
  }
});

/**
 * 5. flashWhite - 闪白
 * 叠加白色层，亮度先增后减
 * 前半段: from → 白色；后半段: 白色 → to
 */
transitions.set('flashWhite', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const intensity = params?.intensity ?? 1.0;

  if (progress < 0.5) {
    // 前半段：from 渐隐 → 白色显现
    const phase = progress * 2; // 0 → 1
    ctx.globalAlpha = 1 - phase * intensity;
    drawFromTo(ctx, fromImg);
    ctx.globalAlpha = 1;

    ctx.fillStyle = `rgba(255, 255, 255, ${phase * intensity})`;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 后半段：白色渐隐 → to 显现
    const phase = (progress - 0.5) * 2; // 0 → 1
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = phase * intensity;
    drawFromTo(ctx, toImg);
    ctx.globalAlpha = 1;
  }
});

/**
 * 6. flashBlack - 闪黑
 * 叠加黑色层，先暗后亮恢复
 * 前半段: from → 黑色；后半段: 黑色 → to
 */
transitions.set('flashBlack', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const intensity = params?.intensity ?? 1.0;

  if (progress < 0.5) {
    // 前半段：from 渐隐 → 黑色显现
    const phase = progress * 2;
    ctx.globalAlpha = 1 - phase * intensity;
    drawFromTo(ctx, fromImg);
    ctx.globalAlpha = 1;

    ctx.fillStyle = `rgba(0, 0, 0, ${phase * intensity})`;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 后半段：黑色渐隐 → to 显现
    const phase = (progress - 0.5) * 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = phase * intensity;
    drawFromTo(ctx, toImg);
    ctx.globalAlpha = 1;
  }
});

/**
 * 7. wipe - 统一擦除转场（根据 direction 参数选择方向）
 * 新画面从指定方向滑入覆盖旧画面
 * 支持：left(从左到右), right(从右到左), top(从上到下), bottom(从下到上)
 */
transitions.set('wipe', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const direction = params?.direction || 'left';

  // 先画 from 帧
  drawFromTo(ctx, fromImg);

  // 用 clip 区域限制 to 帧的显示范围
  ctx.save();
  ctx.beginPath();

  switch (direction) {
    case 'left':
      // 从左向右扩展
      ctx.rect(0, 0, width * progress, height);
      break;
    case 'right':
      // 从右向左扩展
      ctx.rect(width * (1 - progress), 0, width * progress, height);
      break;
    case 'top':
      // 从上向下扩展
      ctx.rect(0, 0, width, height * progress);
      break;
    case 'bottom':
      // 从下向上扩展
      ctx.rect(0, height * (1 - progress), width, height * progress);
      break;
    default:
      ctx.rect(0, 0, width * progress, height);
  }

  ctx.clip();
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 7a. wipeLeft - 左划像（保留向后兼容）
 */
transitions.set('wipeLeft', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number
) => {
  drawFromTo(ctx, fromImg);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width * progress, height);
  ctx.clip();
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 7b. wipeRight - 右划像
 * 新画面从右侧滑入覆盖旧画面
 */
transitions.set('wipeRight', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number
) => {
  drawFromTo(ctx, fromImg);

  ctx.save();
  ctx.beginPath();
  ctx.rect(width * (1 - progress), 0, width * progress, height);
  ctx.clip();
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 7c. wipeUp - 上划像
 * 新画面从上方滑入覆盖旧画面
 */
transitions.set('wipeUp', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number
) => {
  drawFromTo(ctx, fromImg);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height * progress);
  ctx.clip();
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 7d. wipeDown - 下划像
 * 新画面从下方滑入覆盖旧画面
 */
transitions.set('wipeDown', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number
) => {
  drawFromTo(ctx, fromImg);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, height * (1 - progress), width, height * progress);
  ctx.clip();
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 8. maskTransition - 遮罩转场
 * 圆形/星形/菱形遮罩从中心扩展，新画面在遮罩区域内显示
 */
transitions.set('maskTransition', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const shape = params?.shape || 'circle';
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
  const currentRadius = maxRadius * Math.max(0, Math.min(1, progress));

  // 先绘制底层 from 帧
  drawFromTo(ctx, fromImg);

  // 创建形状遮罩裁剪区域
  ctx.save();
  ctx.beginPath();

  switch (shape) {
    case 'circle':
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      break;

    case 'square': {
      const halfSize = currentRadius * 0.707; // sqrt(2)/2 使对角等于半径
      ctx.rect(centerX - halfSize, centerY - halfSize, halfSize * 2, halfSize * 2);
      break;
    }

    case 'star':
      drawStarPath(ctx, centerX, centerY, 5, currentRadius, currentRadius * 0.4);
      break;

    case 'diamond':
      drawDiamondPath(ctx, centerX, centerY, currentRadius);
      break;

    default:
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
  }

  ctx.clip();

  // 在遮罩区域绘制 to 帧
  drawFromTo(ctx, toImg);
  ctx.restore();
});

/**
 * 9. matchCut - 匹配剪辑
 * 基于颜色相似度的快速切换 + 轻微缩放抖动
 * 高相似度时几乎瞬间切换，低相似度时有轻微过渡
 */
transitions.set('matchCut', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const matchType = params?.matchType || 'composition';

  // 计算两帧相似度（仅当两者都是 ImageData 时）
  let similarity = 0.5;
  if (fromImg instanceof ImageData && toImg instanceof ImageData) {
    similarity = calculateColorSimilarity(fromImg, toImg);
  }

  // 根据匹配类型调整切换曲线
  let adjustedProgress: number;

  switch (matchType) {
    case 'composition':
      // 构图匹配：高相似度快速切换
      adjustedProgress = similarity > 0.7
        ? (progress > 0.08 ? 1 : 0)
        : easeInOutCubic(progress);
      break;
    case 'action':
      // 动作匹配：中间加速两端减速
      adjustedProgress = easeInOutQuad(progress);
      break;
    case 'color':
      // 色彩匹配：基于相似度调整
      adjustedProgress = easeInOutCubic(progress * (1 + similarity * 0.5));
      break;
    default:
      adjustedProgress = progress;
  }

  adjustedProgress = Math.max(0, Math.min(1, adjustedProgress));

  // 应用轻微缩放效果模拟"匹配"感
  ctx.save();
  const scale = 1 + (1 - adjustedProgress) * 0.02; // 微小缩放变化
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -height / 2);

  // 混合两帧
  if (adjustedProgress < 0.98) {
    ctx.globalAlpha = 1 - adjustedProgress;
    drawFromTo(ctx, fromImg);
  }
  ctx.globalAlpha = adjustedProgress;
  drawFromTo(ctx, toImg);

  ctx.globalAlpha = 1;
  ctx.restore();
});

/**
 * 10. jumpCut - 跳切
 * 突然跳切，带随机水平偏移模拟胶片跳帧感
 */
transitions.set('jumpCut', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const smoothness = params?.smoothness ?? 0;
  const gapDuration = params?.gapDuration ?? 500;

  // 在临界点前保持 from 帧
  if (progress < 0.92) {
    ctx.save();

    // 接近切换点时添加微小随机偏移模拟跳切不稳定感
    if (progress > 0.7) {
      const jitterIntensity = (progress - 0.7) / 0.22 * (1 - smoothness);
      const offsetX = (Math.random() - 0.5) * jitterIntensity * 6;
      const offsetY = (Math.random() - 0.5) * jitterIntensity * 3;
      ctx.translate(offsetX, offsetY);
    }

    drawFromTo(ctx, fromImg);

    // 接近切换时的微小闪烁
    if (progress > 0.85 && Math.random() > 0.6) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  } else {
    // 突然切换到 to 帧
    drawFromTo(ctx, toImg);
  }
});

/**
 * 11. emptyShot - 空镜转场
 * 插入纯色（黑/白/灰）过渡帧，三阶段: from → 纯色停留 → to
 */
transitions.set('emptyShot', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const holdRatio = params?.holdTime
    ? params.holdTime / (params.duration || 1200)
    : 0.35;
  const solidColor = params?.color || '#000000';

  if (progress < (1 - holdRatio) / 2) {
    // 第一阶段：from → 纯色
    const phase = progress / ((1 - holdRatio) / 2);
    ctx.globalAlpha = 1 - phase;
    drawFromTo(ctx, fromImg);
    ctx.globalAlpha = 1;

    ctx.fillStyle = solidColor;
    ctx.globalAlpha = phase;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  } else if (progress < (1 + holdRatio) / 2) {
    // 第二阶段：保持纯色空镜
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    // 第三阶段：纯色 → to
    const phase = (progress - (1 + holdRatio) / 2) / ((1 - holdRatio) / 2);
    ctx.fillStyle = solidColor;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = phase;
    drawFromTo(ctx, toImg);
    ctx.globalAlpha = 1;
  }
});

/**
 * 12. flashbackTransition - 回忆转场
 * 组合效果：模糊 + 过曝 + 边缘暗角 + 可选色彩偏移
 * 用于暗示进入回忆或梦境场景
 */
transitions.set('flashbackTransition', (
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
) => {
  const blurAmount = params?.blurAmount ?? 8;
  const colorShift = params?.colorShift !== false;

  // 需要像素级操作
  if (fromImg instanceof ImageData && toImg instanceof ImageData) {
    if (progress < 0.5) {
      // 前半段：from 逐渐进入回忆状态（模糊+过曝+暗角）
      const intensity = progress * 2;
      const processed = applyFlashbackEffect(fromImg, width, height, intensity, blurAmount, colorShift);
      ctx.putImageData(processed, 0, 0);

      // 叠加轻微白色光晕
      ctx.fillStyle = `rgba(255, 245, 230, ${intensity * 0.15})`;
      ctx.fillRect(0, 0, width, height);
    } else {
      // 后半段：从回忆状态恢复到 to 正常画面
      const intensity = 1 - (progress - 0.5) * 2;
      const processed = applyFlashbackEffect(toImg, width, height, intensity, blurAmount, colorShift);
      ctx.putImageData(processed, 0, 0);
    }
  } else {
    // 非 ImageData 时回退到简单淡入淡出
    ctx.globalAlpha = 1 - progress;
    drawFromTo(ctx, fromImg);
    ctx.globalAlpha = progress;
    drawFromTo(ctx, toImg);
    ctx.globalAlpha = 1;
  }
});

// ============ 内部辅助函数 ============

/**
 * 缓动函数 - 三次方缓入缓出
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 缓动函数 - 二次方缓入缓出
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 绘制星形路径
 */
function drawStarPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  points: number,
  outerR: number,
  innerR: number
): void {
  const step = Math.PI / points;
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + i * step;
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath();
}

/**
 * 绘制菱形路径
 */
function drawDiamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.7, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.7, cy);
  ctx.closePath();
}

/**
 * 计算两幅图像的颜色相似度（采样版，用于性能优化）
 */
function calculateColorSimilarity(img1: ImageData, img2: ImageData): number {
  const data1 = img1.data;
  const data2 = img2.data;
  let totalDiff = 0;
  const sampleStep = 32; // 每32个像素采样一次
  let count = 0;

  for (let i = 0; i < data1.length; i += sampleStep * 4) {
    totalDiff += Math.abs(data1[i] - data2[i]);
    totalDiff += Math.abs(data1[i + 1] - data2[i + 1]);
    totalDiff += Math.abs(data1[i + 2] - data2[i + 2]);
    count += 3;
  }

  if (count === 0) return 0.5;
  return 1 - Math.min(1, totalDiff / (count * 255));
}

/**
 * 应用回忆转场的组合效果（模糊+过曝+暗角+可选色彩偏移）
 */
function applyFlashbackEffect(
  source: ImageData,
  width: number,
  height: number,
  intensity: number,
  blurAmount: number,
  colorShift: boolean
): ImageData {
  const result = new ImageData(new Uint8ClampedArray(source.data), width, height);
  const data = result.data;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. 过曝效果：提升亮度
      const boost = intensity * blurAmount * 0.8;
      r = Math.min(255, r + boost);
      g = Math.min(255, g + boost);
      b = Math.min(255, b + boost);

      // 2. 降低对比度模拟模糊
      const gray = (r + g + b) / 3;
      const contrastFactor = 1 - intensity * 0.25;
      r = r * contrastFactor + gray * (1 - contrastFactor);
      g = g * contrastFactor + gray * (1 - contrastFactor);
      b = b * contrastFactor + gray * (1 - contrastFactor);

      // 3. 暗角效果
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const vignetteFactor = 1 - (dist / maxDist) * intensity * 0.6;
      r *= vignetteFactor;
      g *= vignetteFactor;
      b *= vignetteFactor;

      // 4. 可选暖色调偏移（怀旧感）
      if (colorShift) {
        r = Math.min(255, r + intensity * 15);
        b = Math.max(0, b - intensity * 10);
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
  }

  return result;
}

// ============ 导出便捷方法 ============

/**
 * 根据名称获取转场处理器
 */
export function getTransition(name: string): TransitionProcessor | undefined {
  return transitions.get(name);
}

/**
 * 执行指定的转场效果
 */
export function applyTransition(
  name: string,
  ctx: CanvasRenderingContext2D,
  fromImg: HTMLImageElement | ImageData | null,
  toImg: HTMLImageElement | ImageData | null,
  progress: number,
  width: number,
  height: number,
  params?: Record<string, any>
): boolean {
  const processor = transitions.get(name);
  if (processor) {
    processor(ctx, fromImg, toImg, progress, width, height, params);
    return true;
  }
  console.warn(`[Transitions] 未知的转场类型: ${name}`);
  return false;
}

/** 所有可用的转场名称列表 */
export const transitionNames: string[] = [
  'hardCut', 'fadeIn', 'fadeOut', 'dissolve',
  'flashWhite', 'flashBlack',
  'wipe', 'wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown',
  'maskTransition', 'matchCut', 'jumpCut', 'emptyShot', 'flashbackTransition'
];
