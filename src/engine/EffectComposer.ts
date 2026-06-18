import type { AppliedEffect, ImageEffectProcessor } from '../types';

/** 图像效果内部使用的类型 */
type InternalEffectType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hueRotate'
  | 'grayscale'
  | 'sepia'
  | 'invert'
  | 'blur'
  | 'sharpen'
  | 'noise'
  | 'vignette'
  | 'colorOverlay'
  | 'chromaticAberration'   // 色差/色散
  | 'glitch'                 // 故障艺术
  | 'chromaKey';             // 绿幕抠像

/**
 * 特效合成器 - 按顺序应用各种图像效果
 * 接收 ImageData，返回处理后的 ImageData
 * 支持效果链式处理和 GPU 加速（OffscreenCanvas）
 */
export class EffectComposer {
  private effectProcessors: Map<InternalEffectType, ImageEffectProcessor> = new Map();
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private useGPUAcceleration: boolean = false;

  constructor() {
    this.registerDefaultEffects();
    this.checkGPUAcceleration();
  }

  /**
   * 注册所有默认效果处理器
   */
  private registerDefaultEffects(): void {
    // 亮度调整
    this.effectProcessors.set('brightness', (data, params) => {
      const adjustment = params.amount ?? 0;
      return this.processPixels(data, (r, g, b) => {
        const factor = (255 * adjustment) / 100;
        return [
          Math.min(255, Math.max(0, r + factor)),
          Math.min(255, Math.max(0, g + factor)),
          Math.min(255, Math.max(0, b + factor)),
        ];
      });
    });

    // 对比度调整
    this.effectProcessors.set('contrast', (data, params) => {
      const factor = (params.amount ?? 100) / 100;
      const intercept = 128 * (1 - factor);
      return this.processPixels(data, (r, g, b) => [
        Math.min(255, Math.max(0, r * factor + intercept)),
        Math.min(255, Math.max(0, g * factor + intercept)),
        Math.min(255, Math.max(0, b * factor + intercept)),
      ]);
    });

    // 饱和度调整
    this.effectProcessors.set('saturation', (data, params) => {
      const adjustment = params.amount ?? 100;
      return this.processPixels(data, (r, g, b) => {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        const satFactor = adjustment / 100;
        return [
          Math.min(255, Math.max(0, gray + (r - gray) * satFactor)),
          Math.min(255, Math.max(0, gray + (g - gray) * satFactor)),
          Math.min(255, Math.max(0, gray + (b - gray) * satFactor)),
        ];
      });
    });

    // 色相旋转
    this.effectProcessors.set('hueRotate', (data, params) => {
      const angle = ((params.angle ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return this.processPixels(data, (r, g, b): [number, number, number] => {
        const newR = r * (0.213 + cos * 0.787 - sin * 0.213) +
                      g * (0.715 - cos * 0.715 - sin * 0.715) +
                      b * (0.072 - cos * 0.072 + sin * 0.928);
        const newG = r * (0.213 - cos * 0.213 + sin * 0.143) +
                      g * (0.715 + cos * 0.285 + sin * 0.140) +
                      b * (0.072 - cos * 0.072 - sin * 0.283);
        const newB = r * (0.213 - cos * 0.213 - sin * 0.787) +
                      g * (0.715 - cos * 0.715 + sin * 0.715) +
                      b * (0.072 + cos * 0.928 + sin * 0.072);
        return [
          Math.min(255, Math.max(0, newR)),
          Math.min(255, Math.max(0, newG)),
          Math.min(255, Math.max(0, newB)),
        ];
      });
    });

    // 灰度
    this.effectProcessors.set('grayscale', (data, params) => {
      const amount = params.amount ?? 100;
      return this.processPixels(data, (r, g, b) => {
        const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
        const factor = amount / 100;
        return [
          r + (gray - r) * factor,
          g + (gray - g) * factor,
          b + (gray - b) * factor,
        ];
      });
    });

    // 复古色调
    this.effectProcessors.set('sepia', (data, params) => {
      const amount = params.amount ?? 100;
      return this.processPixels(data, (r, g, b) => {
        const sepiaR = r * 0.393 + g * 0.769 + b * 0.189;
        const sepiaG = r * 0.349 + g * 0.686 + b * 0.168;
        const sepiaB = r * 0.272 + g * 0.534 + b * 0.131;
        const factor = amount / 100;
        return [
          r + (sepiaR - r) * factor,
          g + (sepiaG - g) * factor,
          b + (sepiaB - b) * factor,
        ];
      });
    });

    // 反色
    this.effectProcessors.set('invert', (data, params) => {
      const amount = (params.amount ?? 100) / 100;
      return this.processPixels(data, (r, g, b) => [
        r + (255 - 2 * r) * amount,
        g + (255 - 2 * g) * amount,
        b + (255 - 2 * b) * amount,
      ]);
    });

    // 模糊（简单盒式模糊）
    this.effectProcessors.set('blur', (data, params) => {
      const radius = Math.floor(params.radius ?? 3);
      if (radius < 1) return data;
      return this.applyBoxBlur(data, radius);
    });

    // 锐化
    this.effectProcessors.set('sharpen', (data, params) => {
      const amount = params.amount ?? 50;
      return this.applyConvolution(data, [
        0, -amount / 100, 0,
        -amount / 100, 1 + 4 * amount / 100, -amount / 100,
        0, -amount / 100, 0,
      ]);
    });

    // 噪点
    this.effectProcessors.set('noise', (data, params) => {
      const intensity = params.intensity ?? 20;
      return this.processPixels(data, (r, g, b) => {
        const noise = (Math.random() - 0.5) * intensity;
        return [
          Math.min(255, Math.max(0, r + noise)),
          Math.min(255, Math.max(0, g + noise)),
          Math.min(255, Math.max(0, b + noise)),
        ];
      });
    });

    // 暗角
    this.effectProcessors.set('vignette', (data, params) => {
      const strength = params.strength ?? 50;
      const { width, height } = data;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const vignette = 1 - (dist / maxDist) * (strength / 100);

          data.data[i] *= vignette;
          data.data[i + 1] *= vignette;
          data.data[i + 2] *= vignette;
        }
      }
      return data;
    });

    // 颜色叠加
    this.effectProcessors.set('colorOverlay', (data, params) => {
      const color: string = String(params.color ?? '#000000');
      const opacity = params.opacity ?? 0.5;
      const rgb = this.hexToRgb(color);

      return this.processPixels(data, (r, g, b) => [
        r + (rgb.r - r) * opacity,
        g + (rgb.g - g) * opacity,
        b + (rgb.b - b) * opacity,
      ]);
    });

    // 色差/色散 - RGB通道错位产生边缘彩虹效果
    this.effectProcessors.set('chromaticAberration', (data, params) => {
      const offset = Math.floor(params.offset ?? 4);
      const angle = ((params.angle ?? 0) * Math.PI) / 180;
      const { width, height } = data;
      const copy = new Uint8ClampedArray(data.data);

      // 计算偏移方向（从中心向外辐射）
      const centerX = width / 2;
      const centerY = height / 2;
      const offsetX = Math.cos(angle) * offset;
      const offsetY = Math.sin(angle) * offset;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          // 从中心的距离决定偏移强度（边缘更强）
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
          const strength = Math.min(1, dist / (maxDist * 0.6));

          // R通道向一个方向偏移，B通道向相反方向偏移
          const rx = Math.round(x + offsetX * strength);
          const bx = Math.round(x - offsetX * strength);
          const ry = Math.round(y + offsetY * strength);
          const by = Math.round(y - offsetY * strength);

          if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
            data.data[i] = copy[(ry * width + rx) * 4]; // R from offset position
          }
          // G保持原位（隐式：data.data[i+1] 不变）
          if (bx >= 0 && bx < width && by >= 0 && by < height) {
            data.data[i + 2] = copy[(by * width + bx) * 4 + 2]; // B from opposite offset
          }
        }
      }

      return data;
    });

    // 故障艺术 - 模拟数字信号故障的像素撕裂效果
    this.effectProcessors.set('glitch', (data, params) => {
      const intensity = (params.intensity ?? 60) / 100; // 0-1 范围
      const rgbSplit = Math.floor(params.rgbSplit ?? 8);
      const { width, height } = data;

      // 随机水平行撕裂
      const sliceHeight = Math.max(2, Math.floor(height * 0.02 * intensity));
      for (let sliceY = Math.floor(height * 0.15); sliceY < height * 0.85; sliceY += sliceHeight + Math.random() * height * 0.15 * intensity) {
        if (Math.random() > intensity * 0.7) continue;

        const startY = Math.floor(sliceY);
        const endY = Math.min(height, startY + sliceHeight);
        const shift = (Math.random() - 0.5) * rgbSplit * 3 * intensity;

        for (let y = startY; y < endY; y++) {
          const rowShift = shift + (Math.sin(y * 0.05) * rgbSplit * intensity);
          const shiftPx = Math.round(rowShift);

          if (Math.abs(shiftPx) < 2) continue;

          // 行像素平移（带边缘截断）
          for (let x = 0; x < width; x++) {
            const srcX = x - shiftPx;
            if (srcX >= 0 && srcX < width) {
              const srcI = (y * width + srcX) * 4;
              const dstI = (y * width + x) * 4;
              data.data[dstI] = data.data[srcI];
              data.data[dstI + 1] = data.data[srcI + 1];
              data.data[dstI + 2] = data.data[srcI + 2];
            }
          }
        }
      }

      // RGB 分离（仅在部分区域）
      if (intensity > 0.3) {
        const copy = new Uint8ClampedArray(data.data);
        const aberrationRange = Math.floor(width * 0.25);
        const startX = Math.floor(Math.random() * (width - aberrationRange));

        for (let y = 0; y < height; y++) {
          for (let x = startX; x < startX + aberrationRange && x < width; x++) {
            const i = (y * width + x) * 4;
            const rx = Math.min(width - 1, x + rgbSplit);
            const bx = Math.max(0, x - rgbSplit);
            data.data[i] = copy[(y * width + rx) * 4];       // R 右移
            data.data[i + 2] = copy[(y * width + bx) * 4 + 2]; // B 左移
          }
        }
      }

      return data;
    });

    // 绿幕抠像 - 移除指定颜色背景使其透明（注意：Canvas2D不支持真正透明合成，此处改为替换为指定颜色或保留）
    this.effectProcessors.set('chromaKey', (data, params) => {
      // 默认目标颜色为绿色 #00FF00
      const targetColor: string = String(params.targetColor ?? '#00FF00');
      const threshold = params.threshold ?? 40;
      const edgeSoftness = params.edgeSoftness ?? 2;
      const targetRgb = this.hexToRgb(targetColor);
      const { width, height } = data;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data.data[i];
          const g = data.data[i + 1];
          const b = data.data[i + 2];

          // 计算与目标颜色的距离
          const dr = r - targetRgb.r;
          const dg = g - targetRgb.g;
          const db = b - targetRgb.b;
          const distance = Math.sqrt(dr * dr + dg * dg + db * db);

          if (distance < threshold) {
            // 在阈值范围内 → 将像素变暗/接近黑色来模拟"移除"
            // （真正的透明需要 WebGL 或离屏 canvas 合成）
            const alpha = Math.min(1, distance / Math.max(threshold / 2, 1));
            data.data[i] = Math.floor(r * alpha * 0.3);
            data.data[i + 1] = Math.floor(g * alpha * 0.3);
            data.data[i + 2] = Math.floor(b * alpha * 0.3);
          }
        }
      }

      return data;
    });
  }

  /**
   * 应用单个效果
   */
  applyEffect(effectType: string, imageData: ImageData, params: Record<string, number> = {}): ImageData {
    const processor = this.effectProcessors.get(effectType as InternalEffectType);
    if (!processor) {
      console.warn(`未知的效果类型: ${effectType}`);
      return imageData;
    }

    // 复制 ImageData 以避免修改原始数据
    const copiedData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    return processor(copiedData, params);
  }

  /**
   * 按顺序合成多个效果
   */
  composeEffects(effects: AppliedEffect[], sourceImageData: ImageData): ImageData {
    let result = new ImageData(
      new Uint8ClampedArray(sourceImageData.data),
      sourceImageData.width,
      sourceImageData.height
    );

    for (const effect of effects) {
      if (this.effectProcessors.has(effect.type as InternalEffectType)) {
        // 将参数转换为数字类型（过滤非数字值）
        const numericParams: Record<string, number> = {};
        for (const [key, value] of Object.entries(effect.params)) {
          if (typeof value === 'number') {
            numericParams[key] = value;
          }
        }
        result = this.applyEffect(effect.type, result, numericParams);
      }
    }

    return result;
  }

  /**
   * 注册自定义效果处理器
   */
  registerEffect(type: string, processor: ImageEffectProcessor): void {
    this.effectProcessors.set(type as InternalEffectType, processor);
  }

  /**
   * 检查是否支持 OffscreenCanvas 加速
   */
  private checkGPUAcceleration(): void {
    try {
      this.offscreenCanvas = new OffscreenCanvas(1, 1);
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      this.useGPUAcceleration = !!this.offscreenCtx;
    } catch {
      this.useGPUAcceleration = false;
    }
  }

  /**
   * 像素级处理辅助方法
   */
  private processPixels(
    imageData: ImageData,
    processor: (r: number, g: number, b: number) => [number, number, number]
  ): ImageData {
    const data = imageData.data;
    const length = data.length;

    for (let i = 0; i < length; i += 4) {
      const [newR, newG, newB] = processor(data[i], data[i + 1], data[i + 2]);
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
    }

    return imageData;
  }

  /**
   * 盒式模糊实现
   */
  private applyBoxBlur(imageData: ImageData, radius: number): ImageData {
    const { width, height, data } = imageData;
    const copy = new Uint8ClampedArray(data);
    const size = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0, g = 0, b = 0, count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              r += copy[idx];
              g += copy[idx + 1];
              b += copy[idx + 2];
              count++;
            }
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = r / count;
        data[idx + 1] = g / count;
        data[idx + 2] = b / count;
      }
    }

    return imageData;
  }

  /**
   * 卷积操作（用于锐化等效果）
   */
  private applyConvolution(imageData: ImageData, kernel: number[]): ImageData {
    const { width, height, data } = imageData;
    const copy = new Uint8ClampedArray(data);
    const side = Math.round(Math.sqrt(kernel.length));
    const halfSide = Math.floor(side / 2);

    for (let y = halfSide; y < height - halfSide; y++) {
      for (let x = halfSide; x < width - halfSide; x++) {
        let r = 0, g = 0, b = 0;

        for (let ky = 0; ky < side; ky++) {
          for (let kx = 0; kx < side; kx++) {
            const idx = ((y + ky - halfSide) * width + (x + kx - halfSide)) * 4;
            const weight = kernel[ky * side + kx];

            r += copy[idx] * weight;
            g += copy[idx + 1] * weight;
            b += copy[idx + 2] * weight;
          }
        }

        const idx = (y * width + x) * 4;
        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
      }
    }

    return imageData;
  }

  /**
   * 十六进制颜色转 RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }
}
