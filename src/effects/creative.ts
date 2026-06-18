/**
 * 创意特殊效果模块 - 5种创意特效实现
 *
 * 每个特效函数签名:
 * (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, any>) => void
 *
 * 包括：故障艺术、胶片模拟、抽帧、纹理叠加、文字卡片转场
 */

// ============ 类型定义 ============

/** 创意特效处理函数类型 */
export type CreativeEffectProcessor = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => void;

/** 创意特效注册表 */
export const creativeEffects: Map<string, CreativeEffectProcessor> = new Map();

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

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

// ============ 5种创意特殊效果实现 ============

/**
 * 1. glitch - 故障艺术（Glitch Art）
 * 模拟数字信号故障产生的视觉效果，包括：
 * - RGB通道分离（色差撕裂）
 * - 扫描线叠加
 * - 数据块随机位移（水平撕裂）
 * - 随机噪点干扰
 * - 像素排序错乱
 */
creativeEffects.set('glitch', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const intensity = param(params, 'intensity', 0.6, 0, 1);
  const rgbSplit = param(params, 'rgbSplit', 8, 0, 30);
  const scanlines = param(params, 'scanlines', true);
  const noiseAmount = param(params, 'noiseAmount', 0.3, 0, 1);

  const width = canvas.width;
  const height = canvas.height;
  const sourceData = ctx.getImageData(0, 0, width, height);
  const srcPixels = sourceData.data;

  // 创建输出图像数据
  const result = new ImageData(width, height);
  const dstPixels = result.data;

  // ===== 1. RGB通道分离 + 水平撕裂 =====
  // 将画面分成若干条带，每条带有随机水平偏移
  const stripeHeight = Math.max(4, Math.floor(height / (8 + Math.random() * 16)));
  const tearIntensity = intensity * rgbSplit;

  for (let y = 0; y < height; y++) {
    // 计算当前行的条带索引和随机偏移
    const stripeIndex = Math.floor(y / stripeHeight);
    const seed = stripeIndex * 2654435761; // Knuth 乘法哈希种子
    const randomOffset = ((seed % 1000) / 1000 - 0.5) * tearIntensity * 2 * intensity;

    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) * 4;

      // R通道：向右偏移
      const rx = Math.max(0, Math.min(width - 1, Math.round(x + randomOffset + tearIntensity * 0.5)));
      dstPixels[dstIdx]     = srcPixels[(y * width + rx) * 4];

      // G通道：原位或微小偏移
      const gx = Math.max(0, Math.min(width - 1, Math.round(x + randomOffset * 0.3)));
      dstPixels[dstIdx + 1] = srcPixels[(y * width + gx) * 4 + 1];

      // B通道：向左偏移
      const bx = Math.max(0, Math.min(width - 1, Math.round(x + randomOffset - tearIntensity * 0.5)));
      dstPixels[dstIdx + 2] = srcPixels[(y * width + bx) * 4 + 2];

      // Alpha：保持原值
      dstPixels[dstIdx + 3] = srcPixels[(y * width + x) * 4 + 3];
    }
  }

  // ===== 2. 数据块随机位移（大块区域撕裂）=====
  if (intensity > 0.3) {
    const blockCount = Math.floor(intensity * 5);
    for (let b = 0; b < blockCount; b++) {
      const blockY = Math.floor(Math.random() * height);
      const blockH = Math.floor(Math.random() * (height * 0.08)) + 4;
      const blockOffset = (Math.random() - 0.5) * tearIntensity * 3;

      for (let y = blockY; y < Math.min(blockY + blockH, height); y++) {
        for (let x = 0; x < width; x++) {
          const srcX = Math.max(0, Math.min(width - 1, Math.round(x - blockOffset)));
          const dstIdx = (y * width + x) * 4;
          const srcIdx = (y * width + srcX) * 4;
          // 只在部分块中完全替换像素
          if (Math.random() > 0.3) {
            dstPixels[dstIdx]     = srcPixels[srcIdx];
            dstPixels[dstIdx + 1] = srcPixels[srcIdx + 1];
            dstPixels[dstIdx + 2] = srcPixels[srcIdx + 2];
          }
        }
      }
    }
  }

  // ===== 3. 随机噪点叠加 =====
  if (noiseAmount > 0) {
    const noiseScale = noiseAmount * intensity * 60;
    for (let i = 0; i < dstPixels.length; i += 4) {
      if (Math.random() < noiseAmount * 0.15) {
        const noiseVal = (Math.random() - 0.5) * noiseScale * 2;
        dstPixels[i]     = clamp(dstPixels[i] + noiseVal);
        dstPixels[i + 1] = clamp(dstPixels[i + 1] + noiseVal);
        dstPixels[i + 2] = clamp(dstPixels[i + 2] + noiseVal);
      }
    }
  }

  ctx.putImageData(result, 0, 0);

  // ===== 4. 扫描线叠加 =====
  if (scanlines && intensity > 0.1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${intensity * 0.15})`;
    for (let y = 0; y < height; y += 2) {
      ctx.fillRect(0, y, width, 1);
    }

    // 偶尔添加亮扫描线（模拟 CRT 显示器）
    if (Math.random() > 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.03})`;
      const brightLine = Math.floor(Math.random() * height);
      ctx.fillRect(0, brightLine, width, 1);
    }
  }
});

/**
 * 2. filmSimulation - 胶片模拟效果
 * 综合模拟各种胶片格式的独特质感和色彩表现：
 * - 胶片颗粒感（基于亮度变化的动态颗粒）
 * - 划痕/划伤痕迹
 * - 光漏效果（边缘不规则色斑）
 * - 色彩偏移（不同胶片的特征色调）
 * - 黑边/暗角（模拟胶片投影区域）
 * - 可选闪烁（模拟放映机不稳定）
 */
creativeEffects.set('filmSimulation', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const filmStock = param(params, 'filmStock', 'kodak2393');
  const grainIntensity = param(params, 'grainIntensity', 0.2, 0, 1);
  const halation = param(params, 'halation', true);
  const flicker = param(params, 'flicker', 0, 0, 0.5);

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 根据胶片型号获取色彩配置
  const filmProfile = getFilmColorProfile(filmStock);

  // ===== 1. 色彩偏移（应用胶片色彩特性）=====
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 应用胶片色调曲线（对比度+伽马调整）
    r = applyFilmCurve(r, filmProfile.gammaR, filmProfile.contrast, filmProfile.liftR);
    g = applyFilmCurve(g, filmProfile.gammaG, filmProfile.contrast, filmProfile.liftG);
    b = applyFilmCurve(b, filmProfile.gammaB, filmProfile.contrast, filmProfile.liftB);

    // 应用色彩偏移
    r = clamp(r + filmProfile.colorShiftR);
    g = clamp(g + filmProfile.colorShiftG);
    b = clamp(b + filmProfile.colorShiftB);

    // 交叉处理（可选的轻微颜色混合）
    const crossMix = filmProfile.crossProcess * 0.01;
    const avg = (r + g + b) / 3;
    r = r * (1 - crossMix) + avg * crossMix;
    g = g * (1 - crossMix * 0.7) + avg * crossMix * 0.7;
    b = b * (1 - crossMix * 1.3) + avg * crossMix * 1.3;

    data[i]     = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  ctx.putImageData(imageData, 0, 0);

  // ===== 2. 胶片颗粒 =====
  if (grainIntensity > 0) {
    applyFilmGrain(ctx, width, height, grainIntensity, filmProfile.grainType);
  }

  // ===== 3. 光晕效果（Halation）=====
  if (halation) {
    applyHalation(ctx, width, height, filmProfile.halationStrength);
  }

  // ===== 4. 胶片划痕 =====
  applyFilmScratches(ctx, width, height, filmProfile.scratchDensity);

  // ===== 5. 投影黑边（模拟胶片画幅）=====
  drawFilmBorders(ctx, width, height, filmProfile.borderStyle);

  // ===== 6. 闪烁效果 =====
  if (flicker > 0) {
    const flickerAlpha = (Math.random() - 0.5) * flicker * 0.1;
    ctx.fillStyle = flickerAlpha > 0
      ? `rgba(255, 255, 255, ${flickerAlpha})`
      : `rgba(0, 0, 0, ${-flickerAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }
});

/**
 * 3. frameSkip - 抽帧效果
 * 有规律地丢弃部分帧，产生卡顿或定格动画般的视觉效果
 * 支持多种抽帧模式：隔帧、每N帧、随机、自定义模式
 * 配合保持帧数和混合模式控制过渡平滑度
 */
creativeEffects.set('frameSkip', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const skipPattern = param(params, 'skipPattern', 'everyOther');
  const holdFrames = param(params, 'holdFrames', 2, 1, 6);
  const blendMode = param(params, 'blendMode', 'none');

  const width = canvas.width;
  const height = canvas.height;

  // currentFrameIndex 由外部传入，用于判断当前帧是否应该显示
  const frameIndex = param(params, 'currentFrameIndex', 0, 0, Infinity);

  // 根据 skipPattern 判断当前帧是否应该"跳过"
  let shouldSkip = false;
  let holdPhase = 0; // 在保持周期内的相位

  switch (skipPattern) {
    case 'everyOther':
      shouldSkip = frameIndex % 2 !== 0;
      holdPhase = frameIndex % (holdFrames * 2) >= holdFrames ? 1 : 0;
      break;

    case 'everyThird':
      shouldSkip = frameIndex % 3 === 2;
      holdPhase = frameIndex % (holdFrames * 3) >= holdFrames * 2 ? 2 : (frameIndex % (holdFrames * 3) >= holdFrames ? 1 : 0);
      break;

    case 'random': {
      // 使用确定性伪随机（基于帧索引），避免闪烁
      const pseudoRandom = (frameIndex * 2654435761 & 0xFFFFFFFF) / 0xFFFFFFFF;
      shouldSkip = pseudoRandom > 0.55;
      break;
    }

    case 'custom': {
      // 自定义模式：使用自定义掩码数组
      const customMask = params?.customMask as boolean[] | undefined;
      if (customMask && customMask.length > 0) {
        shouldSkip = customMask[frameIndex % customMask.length];
      } else {
        // 默认回退到隔帧
        shouldSkip = frameIndex % 2 !== 0;
      }
      break;
    }

    default:
      break;
  }

  if (!shouldSkip) {
    // 正常显示当前帧（无需额外处理）
    return;
  }

  // 当前帧被跳过 → 显示上一帧或应用特殊效果
  const sourceData = ctx.getImageData(0, 0, width, height);

  switch (blendMode) {
    case 'none': {
      // 无混合：直接冻结（保持上一帧不变，无需操作）
      // 实际上由上层渲染引擎控制是否更新帧数据
      break;
    }

    case 'blend': {
      // 帧融合：与前一帧做50%混合，产生运动模糊感
      const prevFrameData = params?._prevFrameData as ImageData | undefined;
      if (prevFrameData) {
        const blended = new ImageData(width, height);
        const sData = sourceData.data;
        const pData = prevFrameData.data;
        const bData = blended.data;

        for (let i = 0; i < sData.length; i += 4) {
          bData[i]     = Math.round(sData[i] * 0.5 + pData[i] * 0.5);
          bData[i + 1] = Math.round(sData[i + 1] * 0.5 + pData[i + 1] * 0.5);
          bData[i + 2] = Math.round(sData[i + 2] * 0.5 + pData[i + 2] * 0.5);
          bData[i + 3] = sData[i + 3];
        }
        ctx.putImageData(blended, 0, 0);
      }
      break;
    }

    case 'motionBlur': {
      // 运动模糊：方向性模糊模拟快速移动
      const blurDirX = params?.motionDirX ?? 1;
      const blurDirY = params?.motionDirY ?? 0;
      const blurAmount = 4;

      const blurred = new ImageData(width, height);
      const sData = sourceData.data;
      const bData = blurred.data;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, count = 0;
          for (let s = 0; s <= blurAmount; s++) {
            const sx = Math.round(x + blurDirX * s);
            const sy = Math.round(y + blurDirY * s);
            if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
              const idx = (sy * width + sx) * 4;
              r += sData[idx];
              g += sData[idx + 1];
              b += sData[idx + 2];
              count++;
            }
          }
          const idx = (y * width + x) * 4;
          bData[idx]     = Math.round(r / count);
          bData[idx + 1] = Math.round(g / count);
          bData[idx + 2] = Math.round(b / count);
          bData[idx + 3] = sData[idx + 3];
        }
      }
      ctx.putImageData(blurred, 0, 0);
      break;
    }

    default:
      break;
  }

  // 添加抽帧指示（轻微视觉提示）
  ctx.strokeStyle = `rgba(255, 200, 0, 0.05)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);
});

/**
 * 4. textureOverlay - 纹理叠加效果
 * 在画面上叠加纸张、划痕、灰尘、水渍等纹理图层增加质感
 * 支持多种混合模式：overlay/multiply/screen/softLight
 */
creativeEffects.set('textureOverlay', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const textureType = param(params, 'textureType', 'paper');
  const opacity = param(params, 'opacity', 0.25, 0, 1);
  const blendMode = param(params, 'blendMode', 'overlay');
  const scale = param(params, 'scale', 1.0, 0.5, 2.0);

  const width = canvas.width;
  const height = canvas.height;

  // 生成纹理图案
  const textureCanvas = document.createElement('canvas');
  const texW = Math.floor(width * scale);
  const texH = Math.floor(height * scale);
  textureCanvas.width = texW;
  textureCanvas.height = texH;
  const texCtx = textureCanvas.getContext('2d')!;

  // 根据类型生成不同的纹理
  generateTexture(texCtx, texW, texH, textureType);

  // 设置混合模式并绘制纹理
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = mapBlendMode(blendMode);
  ctx.drawImage(textureCanvas, 0, 0, width, height);
  ctx.restore();
});

/**
 * 5. textCardTransition - 文字卡片转场效果
 * 以文字卡片形式进行章节或段落间的过渡
 * 包含：文字卡片覆盖 + 打字机/淡入/滑动/缩放/翻页动画
 */
creativeEffects.set('textCardTransition', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const textContent = param(params, 'textContent', '');
  const font = param(params, 'font', 'serif');
  const bgColor = param(params, 'bgColor', '#000000');
  const textColor = param(params, 'textColor', '#FFFFFF');
  const animation = param(params, 'animation', 'typewriter');
  const duration = param(params, 'duration', 2000, 500, 5000);
  // animProgress: 动画进度 0~1
  const animProgress = param(params, 'animProgress', 0, 0, 1);

  const width = canvas.width;
  const height = canvas.height;

  // 保存原始图像
  const originalImage = ctx.getImageData(0, 0, width, height);

  // 清空画布，准备绘制卡片背景
  ctx.save();

  // ===== 背景卡片 =====
  // 卡片尺寸（略小于画布，留出边距）
  const cardMargin = Math.min(width, height) * 0.06;
  const cardX = cardMargin;
  const cardY = cardMargin;
  const cardW = width - cardMargin * 2;
  const cardH = height - cardMargin * 2;

  // 根据动画进度计算卡片入场状态
  let cardAlpha = 1;
  let cardScale = 1;
  let cardOffsetX = 0;
  let cardOffsetY = 0;

  switch (animation) {
    case 'typewriter':
      cardAlpha = easeOutCubic(Math.min(1, animProgress * 2));
      break;

    case 'fade':
      cardAlpha = animProgress;
      break;

    case 'slide': {
      cardAlpha = 1;
      const slideProgress = easeOutCubic(animProgress);
      cardOffsetX = (1 - slideProgress) * width;
      break;
    }

    case 'zoom': {
      const zoomProgress = easeOutBack(animProgress);
      cardScale = 0.3 + zoomProgress * 0.7;
      cardAlpha = zoomProgress;
      break;
    }

    case 'flip': {
      const flipProgress = animProgress;
      cardScale = Math.abs(Math.cos(flipProgress * Math.PI));
      cardAlpha = flipProgress > 0.5 ? 1 : flipProgress * 2;
      break;
    }

    default:
      break;
  }

  // 绘制半透明遮罩层（让底层内容若隐若现）
  ctx.fillStyle = `rgba(0, 0, 0, ${cardAlpha * 0.85})`;
  ctx.fillRect(0, 0, width, height);

  // 绘制卡片背景
  ctx.translate(cardW / 2 + cardX + cardOffsetX, cardH / 2 + cardY + cardOffsetY);
  ctx.scale(cardScale, cardScale);
  ctx.translate(-cardW / 2, -cardH / 2);

  // 圆角矩形卡片
  ctx.fillStyle = bgColor;
  roundRect(ctx, 0, 0, cardW, cardH, 12);
  ctx.fill();

  // 卡片内边框装饰
  ctx.strokeStyle = `${textColor}22`; // 13% 不透明度
  ctx.lineWidth = 1;
  roundRect(ctx, 8, 8, cardW - 16, cardH - 16, 8);
  ctx.stroke();

  // 重置变换以绘制文字
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // ===== 文字内容 =====
  if (textContent) {
    ctx.save();

    // 限制文字绘制区域到卡片内部
    ctx.beginPath();
    roundRect(ctx, cardX + cardOffsetX, cardY + cardOffsetY, cardW * cardScale, cardH * cardScale, 12);
    ctx.clip();

    // 字体设置
    const fontSize = Math.min(cardW, cardH) * 0.06;
    const fontFamily = getFontFamily(font);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 根据动画类型计算可见字符数量
    let visibleChars = textContent.length;

    switch (animation) {
      case 'typewriter': {
        visibleChars = Math.floor(textContent.length * easeOutCubic(animProgress));
        break;
      }

      case 'fade':
      case 'zoom':
      case 'flip': {
        visibleChars = Math.floor(textContent.length * Math.min(1, animProgress * 1.5));
        break;
      }

      default:
        break;
    }

    const displayText = textContent.substring(0, visibleChars);

    // 自动换行绘制
    const lines = wrapText(ctx, displayText, cardW * 0.75);
    const lineHeight = fontSize * 1.6;
    const totalTextHeight = lines.length * lineHeight;
    const startY = cardY + cardH / 2 - totalTextHeight / 2 + cardOffsetY;

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2 + cardOffsetX, startY + index * lineHeight);
    });

    // 打字机光标
    if (animation === 'typewriter' && animProgress < 1 && visibleChars < textContent.length) {
      const cursorBlink = Math.sin(Date.now() / 300) > 0;
      if (cursorBlink) {
        const lastLine = lines[lines.length - 1] || '';
        const lastLineWidth = ctx.measureText(lastLine).width;
        ctx.fillRect(
          width / 2 + lastLineWidth / 2 + 4 + cardOffsetX,
          startY + (lines.length - 1) * lineHeight - fontSize * 0.35,
          2,
          fontSize * 0.8
        );
      }
    }

    ctx.restore();
  }

  ctx.restore();
});

// ============ 内部辅助函数 ============

/**
 * 获取胶片色彩配置文件
 */
function getFilmColorProfile(stock: string): FilmProfile {
  const profiles: Record<string, FilmProfile> = {
    kodak2393: {
      gammaR: 0.95, gammaG: 0.98, gammaB: 1.02,
      contrast: 1.08,
      liftR: 2, liftG: 1, liftB: -1,
      colorShiftR: 8, colorShiftG: -2, colorShiftB: -10,
      crossProcess: 15,
      grainType: 'fine',
      halationStrength: 0.25,
      scratchDensity: 0.3,
      borderStyle: 'widescreen',
    },
    fuji3513: {
      gammaR: 1.0, gammaG: 0.97, gammaB: 0.95,
      contrast: 1.05,
      liftR: 0, liftG: 3, liftB: 2,
      colorShiftR: -5, colorShiftG: 8, colorShiftB: 12,
      crossProcess: 20,
      grainType: 'medium',
      halationStrength: 0.18,
      scratchDensity: 0.2,
      borderStyle: 'standard',
    },
    vision3: {
      gammaR: 0.98, gammaG: 0.98, gammaB: 0.98,
      contrast: 1.12,
      liftR: 1, liftG: 1, liftB: 1,
      colorShiftR: 3, colorShiftG: 1, colorShiftB: -3,
      crossProcess: 5,
      grainType: 'fine',
      halationStrength: 0.15,
      scratchDensity: 0.1,
      borderStyle: 'widescreen',
    },
    cinestill: {
      gammaR: 0.92, gammaG: 0.95, gammaB: 1.05,
      contrast: 1.03,
      liftR: 5, liftG: 2, liftB: -3,
      colorShiftR: 15, colorShiftG: -5, colorShiftB: -15,
      crossProcess: 30,
      grainType: 'medium',
      halationStrength: 0.4,
      scratchDensity: 0.15,
      borderStyle: 'widescreen',
    },
    '16mm': {
      gammaR: 1.0, gammaG: 1.0, gammaB: 1.0,
      contrast: 1.15,
      liftR: 0, liftG: 0, liftB: 0,
      colorShiftR: 5, colorShiftG: 0, colorShiftB: -5,
      crossProcess: 10,
      grainType: 'coarse',
      halationStrength: 0.2,
      scratchDensity: 0.6,
      borderStyle: 'squared',
    },
    '8mm': {
      gammaR: 1.02, gammaG: 1.0, gammaB: 0.95,
      contrast: 1.2,
      liftR: -2, liftG: 0, liftB: 4,
      colorShiftR: 10, colorShiftG: 5, colorShiftB: -8,
      crossProcess: 25,
      grainType: 'veryCoarse',
      halationStrength: 0.3,
      scratchDensity: 0.8,
      borderStyle: 'rounded',
    },
  };

  return profiles[stock] || profiles.kodak2393;
}

interface FilmProfile {
  gammaR: number; gammaG: number; gammaB: number;
  contrast: number;
  liftR: number; liftG: number; liftB: number;
  colorShiftR: number; colorShiftG: number; colorShiftB: number;
  crossProcess: number;
  grainType: string;
  halationStrength: number;
  scratchDensity: number;
  borderStyle: string;
}

/** 应用胶片色调曲线 */
function applyFilmCurve(
  value: number,
  gamma: number,
  contrast: number,
  lift: number
): number {
  // 归一化到 0-1
  let v = value / 255;
  // 提升（lift）
  v = v + lift / 255;
  // 对比度
  v = (v - 0.5) * contrast + 0.5;
  // 伽马校正
  v = Math.pow(Math.max(0, Math.min(1, v)), 1 / gamma);
  return clamp(v * 255);
}

/** 应用胶片颗粒效果 */
function applyFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
  type: string
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  switch (type) {
    case 'fine': {
      // 细腻颗粒
      const scale = intensity * 40;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / (3 * 255);
        const noise = (Math.random() - 0.5) * scale * (0.4 + lum * 0.6);
        data[i]     = clamp(data[i] + noise);
        data[i + 1] = clamp(data[i + 1] + noise);
        data[i + 2] = clamp(data[i + 2] + noise);
      }
      break;
    }

    case 'medium': {
      // 中等颗粒（分块）
      const blockSize = 3;
      const scale = intensity * 50;
      for (let by = 0; by < height; by += blockSize) {
        for (let bx = 0; bx < width; bx += blockSize) {
          const noise = (Math.random() - 0.5) * scale;
          for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
            for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
              const i = ((by + dy) * width + (bx + dx)) * 4;
              data[i]     = clamp(data[i] + noise);
              data[i + 1] = clamp(data[i + 1] + noise);
              data[i + 2] = clamp(data[i + 2] + noise);
            }
          }
        }
      }
      break;
    }

    case 'coarse':
    case 'veryCoarse': {
      // 粗颗粒
      const blockSize = type === 'veryCoarse' ? 5 : 4;
      const scale = intensity * (type === 'veryCoarse' ? 70 : 60);
      for (let by = 0; by < height; by += blockSize) {
        for (let bx = 0; bx < width; bx += blockSize) {
          const noise = (Math.random() - 0.5) * scale;
          for (let dy = 0; dy < blockSize && by + dy < height; dy++) {
            for (let dx = 0; dx < blockSize && bx + dx < width; dx++) {
              const i = ((by + dy) * width + (bx + dx)) * 4;
              data[i]     = clamp(data[i] + noise);
              data[i + 1] = clamp(data[i + 1] + noise);
              data[i + 2] = clamp(data[i + 2] + noise);
            }
          }
        }
      }
      break;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/** 应用光晕效果（Halation）*/
function applyHalation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number
): void {
  if (strength <= 0) return;

  const gradient = ctx.createRadialGradient(
    width * 0.5, height * 0.45, 0,
    width * 0.5, height * 0.45, width * 0.5
  );
  gradient.addColorStop(0, `rgba(255, 240, 220, ${strength * 0.12})`);
  gradient.addColorStop(0.5, `rgba(255, 220, 180, ${strength * 0.06})`);
  gradient.addColorStop(1, 'rgba(255, 200, 150, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/** 应用胶片划痕效果 */
function applyFilmScratches(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  density: number
): void {
  if (density <= 0) return;

  const scratchCount = Math.floor(density * 15);

  for (let i = 0; i < scratchCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const length = 20 + Math.random() * (height * 0.3);
    const angle = (Math.random() - 0.5) * 0.3; // 接近垂直
    const alpha = 0.02 + Math.random() * density * 0.08;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = `rgba(255, 255, 245, ${alpha})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, length);
    ctx.stroke();
    ctx.restore();
  }
}

/** 绘制胶片边框 */
function drawFilmBorders(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: string
): void {
  ctx.fillStyle = '#000000';

  switch (style) {
    case 'widescreen': {
      // 宽银幕上下黑边
      const barH = height * 0.12;
      ctx.fillRect(0, 0, width, barH);           // 上边
      ctx.fillRect(0, height - barH, width, barH); // 下边
      break;
    }

    case 'standard': {
      // 标准胶片小边框
      const margin = 4;
      ctx.fillRect(0, 0, width, margin);
      ctx.fillRect(0, height - margin, width, margin);
      ctx.fillRect(0, 0, margin, height);
      ctx.fillRect(width - margin, 0, margin, height);
      break;
    }

    case 'squared': {
      // 方形 16mm 边框
      const margin = 8;
      ctx.fillRect(0, 0, width, margin);
      ctx.fillRect(0, height - margin, width, margin);
      ctx.fillRect(0, 0, margin, height);
      ctx.fillRect(width - margin, 0, margin, height);
      // 齿孔标记
      ctx.fillStyle = '#222222';
      for (let y = 20; y < height - 20; y += 30) {
        ctx.fillRect(width - margin - 4, y, 4, 14);
        ctx.fillRect(0, y, 4, 14);
      }
      break;
    }

    case 'rounded': {
      // 8mm 圆角边框
      const margin = 10;
      ctx.beginPath();
      ctx.roundRect(0, 0, width, height, [margin, margin, margin, margin]);
      ctx.fillStyle = '#000000';
      ctx.fill();
      // 齿孔
      ctx.fillStyle = '#333333';
      for (let y = 15; y < height - 15; y += 24) {
        ctx.fillRect(width - margin - 3, y, 3, 10);
        ctx.fillRect(0, y, 3, 10);
      }
      break;
    }

    default:
      break;
  }
}

/** 生成纹理图案 */
function generateTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: string
): void {
  switch (type) {
    case 'paper': {
      // 纸张纹理：细微噪点 + 纤维感
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, width, height);
      const imgData = ctx.createImageData(width, height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = 200 + Math.random() * 30;
        imgData.data[i] = v;
        imgData.data[i + 1] = v - 5 + Math.random() * 10;
        imgData.data[i + 2] = v - 15 + Math.random() * 10;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      break;
    }

    case 'scratches': {
      // 胶片划痕纹理
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'transparent';
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * width;
        const alpha = 0.1 + Math.random() * 0.3;
        ctx.strokeStyle = `rgba(255, 250, 240, ${alpha})`;
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 20, height);
        ctx.stroke();
      }
      break;
    }

    case 'dust': {
      // 灰尘纹理：散布的小点
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < width * height * 0.003; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 0.5 + Math.random() * 2;
        const alpha = 0.2 + Math.random() * 0.5;
        ctx.fillStyle = `rgba(200, 190, 170, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'watermark': {
      // 水渍纹理：不规则的浅色斑块
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < 5; i++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const radius = 30 + Math.random() * 80;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, 'rgba(180, 175, 165, 0.15)');
        gradient.addColorStop(0.7, 'rgba(180, 175, 165, 0.05)');
        gradient.addColorStop(1, 'rgba(180, 175, 165, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'lightLeak': {
      // 光漏纹理：角落的不规则彩色光斑
      ctx.clearRect(0, 0, width, height);
      // 左上角橙色光漏
      const grad1 = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.6);
      grad1.addColorStop(0, 'rgba(255, 120, 40, 0.3)');
      grad1.addColorStop(0.5, 'rgba(255, 80, 20, 0.1)');
      grad1.addColorStop(1, 'rgba(255, 60, 10, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);
      // 右下角蓝色光漏
      const grad2 = ctx.createRadialGradient(width, height, 0, width, height, width * 0.5);
      grad2.addColorStop(0, 'rgba(40, 100, 200, 0.15)');
      grad2.addColorStop(0.6, 'rgba(30, 70, 150, 0.05)');
      grad2.addColorStop(1, 'rgba(20, 50, 120, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'noise': {
      // 纯噪点纹理
      const imgData = ctx.createImageData(width, height);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 60;
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v;
        imgData.data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      break;
    }

    default:
      ctx.fillStyle = '#888888';
      ctx.fillRect(0, 0, width, height);
  }
}

/** 映射混合模式字符串为 Canvas compositeOperation */
function mapBlendMode(mode: string): GlobalCompositeOperation {
  const modes: Record<string, GlobalCompositeOperation> = {
    overlay: 'overlay',
    multiply: 'multiply',
    screen: 'screen',
    softLight: 'soft-light',
    hardLight: 'hard-light',
    colorDodge: 'color-dodge',
    colorBurn: 'color-burn',
  };
  return modes[mode] || 'source-over';
}

/** 缓动函数 - cubic ease out */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 缓动函数 - back ease out（带轻微过冲）*/
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** 绘制圆角矩形路径 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 获取字体族名称 */
function getFontFamily(font: string): string {
  const fonts: Record<string, string> = {
    serif: 'Georgia, "Times New Roman", serif',
    'sans-serif': '"Helvetica Neue", Arial, sans-serif',
    monospace: '"Courier New", monospace',
    handwriting: '"Comic Sans MS", cursive',
  };
  return fonts[font] || fonts['sans-serif'];
}

/** 自动换行文本 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// ============ 导出便捷方法 ============

/**
 * 根据名称获取创意特效处理器
 */
export function getCreativeEffect(name: string): CreativeEffectProcessor | undefined {
  return creativeEffects.get(name);
}

/**
 * 执行指定的创意特效
 */
export function applyCreativeEffect(
  name: string,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
): boolean {
  const processor = creativeEffects.get(name);
  if (processor) {
    processor(ctx, canvas, params);
    return true;
  }
  console.warn(`[CreativeEffects] 未知的创意特效: ${name}`);
  return false;
}

/** 所有可用的创意特效名称列表 */
export const creativeEffectNames: string[] = [
  'glitch', 'filmSimulation', 'frameSkip',
  'textureOverlay', 'textCardTransition'
];
