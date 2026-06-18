import type { SimpleTransitionType } from '../types';

interface TransitionParams {
  direction?: 'left' | 'right' | 'up' | 'down';
  maskImage?: ImageData;
  color?: string;
}

/**
 * 转场引擎 - 处理两个片段之间的转场效果
 * 支持硬切、淡入淡出、叠化、闪白/闪黑、划像、遮罩等多种转场类型
 */
export class TransitionEngine {
  private tempCanvas: OffscreenCanvas;
  private tempCtx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.tempCanvas = new OffscreenCanvas(1, 1);
    const ctx = this.tempCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 OffscreenCanvas 渲染上下文');
    }
    this.tempCtx = ctx;
  }

  /**
   * 渲染转场效果
   * @param type 转场类型
   * @param ctx 目标 Canvas 上下文
   * @param fromImageData 起始帧图像数据
   * @param toImageData 结束帧图像数据
   * @param progress 转场进度 (0~1)
   * @param width 画布宽度
   * @param height 画布高度
   * @param params 额外参数（如方向、遮罩等）
   */
  renderTransition(
    type: string,
    ctx: CanvasRenderingContext2D,
    fromImageData: ImageData,
    toImageData: ImageData,
    progress: number,
    width: number,
    height: number,
    params?: TransitionParams
  ): void {
    // 确保 progress 在有效范围内
    progress = Math.max(0, Math.min(1, progress));

    // 更新临时画布尺寸
    this.tempCanvas.width = width;
    this.tempCanvas.height = height;

    switch (type) {
      case 'cut':
        this.renderCut(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'fade':
        this.renderFade(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'dissolve':
        this.renderDissolve(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'flashWhite':
        this.renderFlashWhite(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'flashBlack':
        this.renderFlashBlack(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'wipeLeft':
        this.renderWipe(ctx, fromImageData, toImageData, progress, width, height, { ...params, direction: 'left' });
        break;
      case 'wipeRight':
        this.renderWipe(ctx, fromImageData, toImageData, progress, width, height, { ...params, direction: 'right' });
        break;
      case 'wipeUp':
        this.renderWipe(ctx, fromImageData, toImageData, progress, width, height, { ...params, direction: 'up' });
        break;
      case 'wipeDown':
        this.renderWipe(ctx, fromImageData, toImageData, progress, width, height, { ...params, direction: 'down' });
        break;
      case 'mask':
        this.renderMaskTransition(ctx, fromImageData, toImageData, progress, width, height, params);
        break;
      case 'matchCut':
        this.renderMatchCut(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'jumpCut':
        this.renderJumpCut(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'blackScreen':
        this.renderBlackScreen(ctx, fromImageData, toImageData, progress, width, height);
        break;
      case 'flashback':
        this.renderFlashback(ctx, fromImageData, toImageData, progress, width, height);
        break;
      default:
        // 默认使用淡入淡出
        this.renderFade(ctx, fromImageData, toImageData, progress, width, height);
    }
  }

  /**
   * 硬切 - 直接切换
   */
  private renderCut(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 进度 < 0.5 显示 from，否则显示 to
    const imageData = progress < 0.5 ? fromData : toData;
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * 淡入淡出 - alpha 渐变
   */
  private renderFade(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 先绘制 from 帧并降低透明度
    ctx.globalAlpha = 1 - progress;
    ctx.putImageData(fromData, 0, 0);

    // 绘制 to 帧并增加透明度
    ctx.globalAlpha = progress;
    ctx.putImageData(toData, 0, 0);

    ctx.globalAlpha = 1;
  }

  /**
   * 叠化 - 交叉淡化
   */
  private renderDissolve(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 使用像素级混合实现更平滑的叠化效果
    const result = new ImageData(width, height);
    const fromPixels = fromData.data;
    const toPixels = toData.data;
    const resultPixels = result.data;

    for (let i = 0; i < fromPixels.length; i += 4) {
      resultPixels[i] = fromPixels[i] + (toPixels[i] - fromPixels[i]) * progress;
      resultPixels[i + 1] = fromPixels[i + 1] + (toPixels[i + 1] - fromPixels[i + 1]) * progress;
      resultPixels[i + 2] = fromPixels[i + 2] + (toPixels[i + 2] - fromPixels[i + 2]) * progress;
      resultPixels[i + 3] = 255;
    }

    ctx.putImageData(result, 0, 0);
  }

  /**
   * 闪白 - 叠加白色层并渐变
   */
  private renderFlashWhite(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 前半段：from -> 白色
    // 后半段：白色 -> to
    if (progress < 0.5) {
      const fadeProgress = progress * 2; // 0 -> 1

      // 绘制 from 帧
      ctx.globalAlpha = 1 - fadeProgress;
      ctx.putImageData(fromData, 0, 0);

      // 叠加白色层
      ctx.globalAlpha = fadeProgress;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    } else {
      const fadeProgress = (progress - 0.5) * 2; // 0 -> 1

      // 绘制白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 绘制 to 帧
      ctx.globalAlpha = fadeProgress;
      ctx.putImageData(toData, 0, 0);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 闪黑 - 叠加黑色层并渐变
   */
  private renderFlashBlack(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    if (progress < 0.5) {
      const fadeProgress = progress * 2;

      ctx.globalAlpha = 1 - fadeProgress;
      ctx.putImageData(fromData, 0, 0);

      ctx.globalAlpha = fadeProgress;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else {
      const fadeProgress = (progress - 0.5) * 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = fadeProgress;
      ctx.putImageData(toData, 0, 0);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * 划像 - 使用裁剪区域实现方向性过渡
   */
  private renderWipe(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number,
    params?: TransitionParams
  ): void {
    const direction = params?.direction ?? 'right';

    ctx.save();

    // 绘制 from 帧
    ctx.putImageData(fromData, 0, 0);

    // 设置裁剪区域显示 to 帧
    ctx.beginPath();
    let clipX = 0, clipY = 0, clipW = width, clipH = height;

    switch (direction) {
      case 'left':
        clipW = width * progress;
        break;
      case 'right':
        clipX = width * (1 - progress);
        clipW = width * progress;
        break;
      case 'up':
        clipH = height * progress;
        break;
      case 'down':
        clipY = height * (1 - progress);
        clipH = height * progress;
        break;
    }

    ctx.rect(clipX, clipY, clipW, clipH);
    ctx.clip();
    ctx.putImageData(toData, 0, 0);

    ctx.restore();
  }

  /**
   * 遮罩转场 - 使用自定义遮罩图案
   */
  private renderMaskTransition(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number,
    params?: TransitionParams
  ): void {
    const maskImage = params?.maskImage;

    if (!maskImage || maskImage.width !== width || maskImage.height !== height) {
      // 没有遮罩时回退到圆形遮罩
      this.renderCircleMask(ctx, fromData, toData, progress, width, height);
      return;
    }

    // 使用提供的遮罩图像
    const result = new ImageData(width, height);
    const fromPixels = fromData.data;
    const toPixels = toData.data;
    const maskPixels = maskImage.data;
    const resultPixels = result.data;

    for (let i = 0; i < fromPixels.length; i += 4) {
      const maskValue = maskPixels[i] / 255; // 使用红色通道作为遮罩值

      // 根据 progress 和遮罩值混合
      const mixFactor = Math.min(1, maskValue / (1 - progress + 0.001));

      resultPixels[i] = fromPixels[i] + (toPixels[i] - fromPixels[i]) * mixFactor;
      resultPixels[i + 1] = fromPixels[i + 1] + (toPixels[i + 1] - fromPixels[i + 1]) * mixFactor;
      resultPixels[i + 2] = fromPixels[i + 2] + (toPixels[i + 2] - fromPixels[i + 2]) * mixFactor;
      resultPixels[i + 3] = 255;
    }

    ctx.putImageData(result, 0, 0);
  }

  /**
   * 圆形遮罩（默认遮罩）
   */
  private renderCircleMask(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    ctx.save();

    // 绘制 from 帧
    ctx.putImageData(fromData, 0, 0);

    // 创建圆形裁剪区域，随进度扩大
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const currentRadius = maxRadius * progress;

    ctx.beginPath();
    ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    ctx.clip();

    // 在圆形区域内绘制 to 帧
    ctx.putImageData(toData, 0, 0);

    ctx.restore();
  }

  /**
   * 匹配剪辑 - 基于画面相似度的智能切换（模拟）
   */
  private renderMatchCut(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 计算两帧的相似度（简化版）
    const similarity = this.calculateSimilarity(fromData, toData);

    // 根据相似度调整切换曲线
    // 高相似度时快速切换，低相似度时添加轻微抖动
    let adjustedProgress: number;

    if (similarity > 0.8) {
      // 高相似度：几乎瞬间切换
      adjustedProgress = progress > 0.05 ? 1 : 0;
    } else {
      // 低相似度：带抖动的渐进切换
      const jitter = (Math.random() - 0.5) * 0.02 * (1 - similarity);
      adjustedProgress = Math.max(0, Math.min(1, progress + jitter));
    }

    this.renderFade(ctx, fromData, toData, adjustedProgress, width, height);
  }

  /**
   * 跳切 - 突然切换，可带微小闪烁
   */
  private renderJumpCut(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 在临界点附近添加微小的随机偏移模拟跳切感
    if (progress < 0.95) {
      ctx.putImageData(fromData, 0, 0);

      // 接近切换点时添加微小闪烁
      if (progress > 0.8 && Math.random() > 0.7) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.putImageData(toData, 0, 0);
    }
  }

  /**
   * 空镜转场 - 插入黑屏过渡
   */
  private renderBlackScreen(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 三段式：from -> 黑屏 -> to
    if (progress < 0.33) {
      // 第一阶段：from 渐隐到黑屏
      const phaseProgress = progress / 0.33;
      ctx.globalAlpha = 1 - phaseProgress;
      ctx.putImageData(fromData, 0, 0);
      ctx.globalAlpha = 1;
    } else if (progress < 0.66) {
      // 第二阶段：保持黑屏
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    } else {
      // 第三阶段：黑屏渐显到 to
      const phaseProgress = (progress - 0.66) / 0.34;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = phaseProgress;
      ctx.putImageData(toData, 0, 0);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * 闪回转场 - 结合模糊+过曝效果
   */
  private renderFlashback(
    ctx: CanvasRenderingContext2D,
    fromData: ImageData,
    toData: ImageData,
    progress: number,
    width: number,
    height: number
  ): void {
    // 创建临时图像数据进行处理
    const tempFrom = new ImageData(new Uint8ClampedArray(fromData.data), width, height);
    const tempTo = new ImageData(new Uint8ClampedArray(toData.data), width, height);

    if (progress < 0.5) {
      // 前半段：模糊+过曝增强
      const intensity = progress * 2;

      // 应用过曝效果
      this.applyOverexposure(tempFrom, intensity);
      // 应用模糊效果（简化版：降低对比度模拟）
      this.applySoftBlur(tempFrom, intensity * 0.5);

      ctx.putImageData(tempFrom, 0, 0);

      // 添加白色叠加层
      ctx.globalAlpha = intensity * 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    } else {
      // 后半段：从过曝状态恢复到正常画面
      const intensity = 1 - (progress - 0.5) * 2;

      this.applyOverexposure(tempTo, intensity);
      this.applySoftBlur(tempTo, intensity * 0.5);

      ctx.putImageData(tempTo, 0, 0);
    }
  }

  /**
   * 计算两幅图像的相似度（简化版）
   */
  private calculateSimilarity(img1: ImageData, img2: ImageData): number {
    const data1 = img1.data;
    const data2 = img2.data;
    let totalDiff = 0;
    const sampleSize = Math.min(data1.length, data2.length);

    // 采样计算以提高性能
    const step = 16; // 每16个像素采样一次
    let count = 0;

    for (let i = 0; i < sampleSize; i += step * 4) {
      totalDiff += Math.abs(data1[i] - data2[i]);
      totalDiff += Math.abs(data1[i + 1] - data2[i + 1]);
      totalDiff += Math.abs(data1[i + 2] - data2[i + 2]);
      count += 3;
    }

    return 1 - totalDiff / (count * 255);
  }

  /**
   * 应用过曝效果
   */
  private applyOverexposure(imageData: ImageData, intensity: number): void {
    const data = imageData.data;
    const boost = intensity * 50;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, data[i] + boost);
      data[i + 1] = Math.min(255, data[i + 1] + boost);
      data[i + 2] = Math.min(255, data[i + 2] + boost);
    }
  }

  /**
   * 应用软模糊效果（通过降低对比度模拟）
   */
  private applySoftBlur(imageData: ImageData, intensity: number): void {
    const data = imageData.data;
    const factor = 1 - intensity * 0.3;
    const grayBoost = intensity * 20;

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i] * factor + gray * (1 - factor) + grayBoost;
      data[i + 1] = data[i + 1] * factor + gray * (1 - factor) + grayBoost;
      data[i + 2] = data[i + 2] * factor + gray * (1 - factor) + grayBoost;
    }
  }
}
