/**
 * 色彩光影效果模块 - 5种色彩处理实现
 *
 * 每个特效函数签名:
 * (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, any>) => void
 *
 * 操作像素数据（getImageData/putImageData），实现色彩分级、单色化、暗角等
 */

// ============ 类型定义 ============

/** 色彩特效处理函数类型 */
export type ColorEffectProcessor = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => void;

/** 色彩特效注册表 */
export const colorEffects: Map<string, ColorEffectProcessor> = new Map();

// ============ 辅助函数 ============

/** 安全获取参数值，带默认值和范围限制 */
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

/** 十六进制颜色转 RGB */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}

/** 像素值钳制到 0-255 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// ============ 5种色彩光影效果实现 ============

/**
 * 1. colorGrade - 分级调色
 * 全面调整画面的亮度/对比度/饱和度/色温/色调
 * 模拟专业调色软件的核心参数
 */
colorEffects.set('colorGrade', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  // 默认参数给轻微可见值（全0=无变化，用户看不到效果）
  const brightness = param(params, 'brightness', 5, -100, 100);
  const contrast = param(params, 'contrast', 10, -100, 100);
  const saturation = param(params, 'saturation', 10, -100, 100);
  const temperature = param(params, 'temperature', 0, -100, 100); // 色温：负=冷，正=暖
  const tint = param(params, 'tint', 0, -100, 100); // 色调偏移

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 预计算对比度参数
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const brightnessOffset = (brightness / 100) * 255;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. 亮度调整
    r += brightnessOffset;
    g += brightnessOffset;
    b += brightnessOffset;

    // 2. 对比度调整
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;

    // 3. 饱和度调整（基于灰度的加权混合）
    const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
    const satFactor = 1 + saturation / 100;
    r = gray + (r - gray) * satFactor;
    g = gray + (g - gray) * satFactor;
    b = gray + (b - gray) * satFactor;

    // 4. 色温调整（暖色增加红/蓝，冷色减少红/蓝）
    const tempFactor = temperature / 100;
    r += tempFactor * 30;
    b -= tempFactor * 30;

    // 5. 色调偏移（品红/绿色方向）
    const tintFactor = tint / 100;
    r += tintFactor * 15;
    g -= tintFactor * 10;

    data[i]     = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  ctx.putImageData(imageData, 0, 0);
});

/**
 * 2. monochrome - 单色化效果
 * 将画面转换为黑白或单一色调，支持多种预设模式
 * 包括：灰度、棕褐色(sepia)、冷蓝、暖橙、自定义单色
 */
colorEffects.set('monochrome', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const mode = param(params, 'mode', 'grayscale');
  const intensity = param(params, 'intensity', 1.0, 0, 1);
  const filterColorStr = param(params, 'filterColor', '#808080');

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 根据模式确定目标 RGB 值
  let targetR = 128, targetG = 128, targetB = 128;

  switch (mode) {
    case 'grayscale':
      // 标准灰度：直接使用 luminance 系数
      break;

    case 'sepia':
      // 棕褐色调
      targetR = 112; targetG = 66; targetB = 20;
      break;

    case 'cool':
      // 冷蓝色调
      targetR = 80; targetG = 100; targetB = 140;
      break;

    case 'warm':
      // 暖橙色调
      targetR = 180; targetG = 130; targetB = 70;
      break;

    case 'custom': {
      // 自定义单色
      const customRgb = hexToRgb(filterColorStr);
      targetR = customRgb.r;
      targetG = customRgb.g;
      targetB = customRgb.b;
      break;
    }

    default:
      break;
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 计算亮度值（使用人眼感知权重）
    const luminance = 0.2989 * r + 0.587 * g + 0.114 * b;

    if (mode === 'grayscale') {
      // 纯灰度模式
      data[i]     = clamp(r + (luminance - r) * intensity);
      data[i + 1] = clamp(g + (luminance - g) * intensity);
      data[i + 2] = clamp(b + (luminance - b) * intensity);
    } else {
      // 单色调模式：先去饱和，再叠加目标颜色
      const grayVal = luminance;
      data[i]     = clamp(r + ((grayVal * targetR / 128) - r) * intensity);
      data[i + 1] = clamp(g + ((grayVal * targetG / 128) - g) * intensity);
      data[i + 2] = clamp(b + ((grayVal * targetB / 128) - b) * intensity);
    }
  }

  ctx.putImageData(imageData, 0, 0);
});

/**
 * 3. vignette - 暗角光晕效果
 * 画面边缘逐渐变暗，引导视线聚焦于中心区域
 * 支持可调节的半径、柔化程度和暗角强度
 */
colorEffects.set('vignette', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const radius = param(params, 'radius', 0.6, 0, 1);
  const softness = param(params, 'softness', 0.5, 0, 1);
  const amount = param(params, 'amount', 0.5, 0, 1);

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 计算暗角起始距离和过渡区域宽度
  const vignetteStart = maxDist * radius;
  const transitionWidth = maxDist * softness * (1 - radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 计算暗角因子（使用平滑阶梯函数避免硬边缘）
      let vignetteFactor: number;
      if (dist <= vignetteStart) {
        vignetteFactor = 1;
      } else if (dist >= vignetteStart + transitionWidth) {
        vignetteFactor = 1 - amount;
      } else {
        // 平滑过渡区（使用 smoothstep 插值）
        const t = (dist - vignetteStart) / transitionWidth;
        const smoothT = t * t * (3 - 2 * t); // smoothstep
        vignetteFactor = 1 - amount * smoothT;
      }

      data[i]     = clamp(data[i] * vignetteFactor);
      data[i + 1] = clamp(data[i + 1] * vignetteFactor);
      data[i + 2] = clamp(data[i + 2] * vignetteFactor);
    }
  }

  ctx.putImageData(imageData, 0, 0);
});

/**
 * 4. chromaticAberration - 色差分离效果
 * RGB通道错位，模拟镜头色散现象
 * 支持径向色散（从中心向外增强）和角度可控的方向性色差
 */
colorEffects.set('chromaticAberration', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const offset = param(params, 'offset', 4, 0, 30);
  const angleDeg = param(params, 'angle', 0, 0, 360);
  const radial = param(params, 'radial', true);

  if (offset <= 0) return; // 无偏移时跳过

  const width = canvas.width;
  const height = canvas.height;
  const sourceData = ctx.getImageData(0, 0, width, height);
  const srcPixels = sourceData.data;
  const result = new ImageData(width, height);
  const dstPixels = result.data;

  const centerX = width / 2;
  const centerY = height / 2;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(angleRad);
  const dirY = Math.sin(angleRad);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;

      // 计算当前像素的采样偏移
      let redOffset = offset;
      let blueOffset = -offset;

      if (radial) {
        // 径向色散：从中心向外增强
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const radialFactor = dist / maxDist;

        redOffset *= radialFactor;
        blueOffset *= radialFactor;

        // 使用径向方向
        if (dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          // R 通道沿径向向外偏移
          const rx = Math.round(x + nx * redOffset);
          const ry = Math.round(y + ny * redOffset);
          // B 通道沿径向向内偏移
          const bx = Math.round(x - nx * Math.abs(blueOffset));
          const by = Math.round(y - ny * Math.abs(blueOffset));

          // 采样各通道
          dstPixels[dstIdx]     = samplePixel(srcPixels, rx, ry, width, height, 0);       // R
          dstPixels[dstIdx + 1] = samplePixel(srcPixels, x, y, width, height, 1);         // G (原位)
          dstPixels[dstIdx + 2] = samplePixel(srcPixels, bx, by, width, height, 2);       // B
          dstPixels[dstIdx + 3] = samplePixel(srcPixels, x, y, width, height, 3);         // Alpha
        } else {
          // 中心点不偏移
          dstPixels[dstIdx]     = srcPixels[dstIdx];
          dstPixels[dstIdx + 1] = srcPixels[dstIdx + 1];
          dstPixels[dstIdx + 2] = srcPixels[dstIdx + 2];
          dstPixels[dstIdx + 3] = srcPixels[dstIdx + 3];
        }
      } else {
        // 方向性色散：沿指定角度偏移
        const rx = Math.round(x + dirX * redOffset);
        const ry = Math.round(y + dirY * redOffset);
        const bx = Math.round(x + dirX * blueOffset);
        const by = Math.round(y + dirY * blueOffset);

        dstPixels[dstIdx]     = samplePixel(srcPixels, rx, ry, width, height, 0);
        dstPixels[dstIdx + 1] = samplePixel(srcPixels, x, y, width, height, 1);
        dstPixels[dstIdx + 2] = samplePixel(srcPixels, bx, by, width, height, 2);
        dstPixels[dstIdx + 3] = samplePixel(srcPixels, x, y, width, height, 3);
      }
    }
  }

  ctx.putImageData(result, 0, 0);
});

/**
 * 5. grainNoise - 颗粒噪点效果
 * 叠加胶片颗粒或数字噪点质感
 * 支持：胶片颗粒、数字噪点、高ISO噪点三种类型
 */
colorEffects.set('grainNoise', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const intensity = param(params, 'intensity', 0.15, 0, 1);
  const size = param(params, 'size', 1.5, 0.5, 5);
  const type = param(params, 'type', 'film');

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  switch (type) {
    case 'film': {
      // 胶片颗粒：高斯分布噪声 + 与亮度相关的强度变化
      const noiseScale = intensity * 64;
      for (let i = 0; i < data.length; i += 4) {
        // Box-Muller 变换生成近似高斯分布的随机数
        const u1 = Math.random();
        const u2 = Math.random();
        const gaussianNoise = Math.sqrt(-2 * Math.log(Math.max(u1, 0.0001))) * Math.cos(2 * Math.PI * u2);

        // 噪声强度与像素亮度相关（亮部噪声更明显）
        const luminance = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
        const dynamicIntensity = noiseScale * (0.3 + luminance * 0.7);

        data[i]     = clamp(data[i] + gaussianNoise * dynamicIntensity);
        data[i + 1] = clamp(data[i + 1] + gaussianNoise * dynamicIntensity);
        data[i + 2] = clamp(data[i + 2] + gaussianNoise * dynamicIntensity);
      }
      break;
    }

    case 'digital': {
      // 数字噪点：均匀分布随机噪声
      const noiseRange = intensity * 128;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * noiseRange;
        data[i]     = clamp(data[i] + noise);
        data[i + 1] = clamp(data[i + 1] + noise);
        data[i + 2] = clamp(data[i + 2] + noise);
      }
      break;
    }

    case 'iso': {
      // 高ISO噪点：大颗粒块状噪声（按 size 参数分块）
      const blockSize = Math.max(1, Math.floor(size));
      const noiseRange = intensity * 80;

      for (let by = 0; by < height; by += blockSize) {
        for (let bx = 0; bx < width; bx += blockSize) {
          // 每个块共享同一个随机噪声值
          const blockNoise = (Math.random() - 0.5) * noiseRange;

          for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
            for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
              const i = ((by + dy) * width + (bx + dx)) * 4;
              data[i]     = clamp(data[i] + blockNoise);
              data[i + 1] = clamp(data[i + 1] + blockNoise);
              data[i + 2] = clamp(data[i + 2] + blockNoise);
            }
          }
        }
      }
      break;
    }

    default:
      break;
  }

  ctx.putImageData(imageData, 0, 0);
});

// ============ 内部辅助函数 ============

/**
 * 安全采样像素（边界处理：边缘复制）
 */
function samplePixel(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
  channel: number
): number {
  // 边界钳制
  x = Math.max(0, Math.min(width - 1, Math.round(x)));
  y = Math.max(0, Math.min(height - 1, Math.round(y)));
  return pixels[(y * width + x) * 4 + channel];
}

// ============ 导出便捷方法 ============

/**
 * 根据名称获取色彩特效处理器
 */
export function getColorEffect(name: string): ColorEffectProcessor | undefined {
  return colorEffects.get(name);
}

/**
 * 执行指定的色彩特效
 */
export function applyColorEffect(
  name: string,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
): boolean {
  const processor = colorEffects.get(name);
  if (processor) {
    processor(ctx, canvas, params);
    return true;
  }
  console.warn(`[ColorEffects] 未知的色彩特效: ${name}`);
  return false;
}

/** 所有可用的色彩特效名称列表 */
export const colorEffectNames: string[] = [
  'colorGrade', 'monochrome', 'vignette',
  'chromaticAberration', 'grainNoise'
];
