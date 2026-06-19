/**
 * 画面特效模块 - 10种画面特效实现
 *
 * 每个特效函数签名:
 * (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, params: Record<string, any>) => void
 *
 * 在原始 Canvas 上直接绘制效果，需要先保存/恢复状态
 */

// ============ 类型定义 ============

/** 画面特效处理函数类型 */
export type VisualEffectProcessor = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => void;

/** 画面特效注册表 */
export const visualEffects: Map<string, VisualEffectProcessor> = new Map();

// ============ 辅助函数 ============

/**
 * 安全获取参数值，带默认值和范围限制
 */
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

// ============ 10种画面特效实现 ============

/**
 * 1. splitScreen - 分屏效果
 * 将画面分割成2/3/4个区域同时显示（每个区域可显示不同内容）
 * 支持：垂直分割、水平分割、三等分、四宫格布局
 */
visualEffects.set('splitScreen', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const layout = param(params, 'layout', 'vertical');
  const splitRatio = param(params, 'splitRatio', 0.5, 0.1, 0.9);
  const count = param(params, 'count', 2);
  const width = canvas.width;
  const height = canvas.height;

  // 保存当前画布内容作为源图像
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空画布，准备绘制分屏
  ctx.clearRect(0, 0, width, height);

  // 绘制分隔线背景
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  switch (layout) {
    case 'vertical': {
      // 垂直左右分屏
      const splitX = Math.floor(width * splitRatio);
      // 左半部分
      ctx.putImageData(sourceData, 0, 0);
      // 右半部分（镜像或重复）
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX + 1, 0, width - splitX - 1, height);
      ctx.clip();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.putImageData(sourceData, 0, 0);
      ctx.restore();
      // 中间分隔线
      ctx.fillStyle = '#333333';
      ctx.fillRect(splitX, 0, 1, height);
      break;
    }

    case 'horizontal': {
      // 水平上下分屏
      const splitY = Math.floor(height * splitRatio);
      ctx.putImageData(sourceData, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, splitY + 1, width, height - splitY - 1);
      ctx.clip();
      ctx.translate(0, height);
      ctx.scale(1, -1);
      ctx.putImageData(sourceData, 0, 0);
      ctx.restore();
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, splitY, width, 1);
      break;
    }

    case 'triple': {
      // 三等分
      const thirdW = Math.floor(width / 3);
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * thirdW + (i > 0 ? 1 : 0), 0, thirdW - (i < 2 ? 1 : 0), height);
        ctx.clip();
        if (i % 2 === 1) {
          ctx.translate((i + 1) * thirdW, 0);
          ctx.scale(-1, 1);
          ctx.putImageData(sourceData, 0, 0);
        } else {
          ctx.putImageData(sourceData, 0, 0);
        }
        ctx.restore();
        if (i < 2) {
          ctx.fillStyle = '#333333';
          ctx.fillRect((i + 1) * thirdW, 0, 1, height);
        }
      }
      break;
    }

    case 'grid': {
      // 四宫格
      const halfW = Math.floor(width / 2);
      const halfH = Math.floor(height / 2);
      const positions = [
        { x: 0, y: 0, flipX: 1, flipY: 1 },
        { x: halfW + 1, y: 0, flipX: -1, flipY: 1 },
        { x: 0, y: halfH + 1, flipX: 1, flipY: -1 },
        { x: halfW + 1, y: halfH + 1, flipX: -1, flipY: -1 },
      ];
      positions.forEach((pos) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(pos.x, pos.y, halfW - (pos.x === 0 ? 1 : 0), halfH - (pos.y === 0 ? 1 : 0));
        ctx.clip();
        ctx.translate(
          pos.flipX === 1 ? 0 : width,
          pos.flipY === 1 ? 0 : height
        );
        ctx.scale(pos.flipX, pos.flipY);
        ctx.putImageData(sourceData, 0, 0);
        ctx.restore();
      });
      // 网格线
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(halfW, 0); ctx.lineTo(halfW, height);
      ctx.moveTo(0, halfH); ctx.lineTo(width, halfH);
      ctx.stroke();
      break;
    }

    default:
      ctx.putImageData(sourceData, 0, 0);
  }
});

/**
 * 2. pictureInPicture - 画中画效果
 * 主画面保持原样，在角落叠加一个缩小的子窗口
 * 支持调节位置、大小和圆角
 */
visualEffects.set('pictureInPicture', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const scale = param(params, 'scale', 0.3, 0.1, 0.7);
  const posX = param(params, 'positionX', 80, 5, 95); // 百分比
  const posY = param(params, 'positionY', 80, 5, 95); // 百分比
  const borderRadius = param(params, 'borderRadius', 8, 0, 30);

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // 子窗口尺寸
  const pipWidth = Math.floor(canvasWidth * scale);
  const pipHeight = Math.floor(canvasHeight * scale);
  // 子窗口位置（基于百分比）
  const pipX = Math.floor(canvasWidth * posX / 100) - pipWidth / 2;
  const pipY = Math.floor(canvasHeight * posY / 100) - pipHeight / 2;

  // 保存主画面（已在 canvas 上）
  const mainImage = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

  // 绘制子窗口阴影/边框
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;

  // 圆角裁剪区域
  if (borderRadius > 0) {
    ctx.beginPath();
    roundRect(ctx, pipX, pipY, pipWidth, pipHeight, borderRadius);
    ctx.clip();
  }

  // 绘制子窗口内容（缩小后的主画面）
  ctx.drawImage(
    canvas,
    pipX, pipY, pipWidth, pipHeight
  );

  ctx.restore();

  // 绘制边框
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  if (borderRadius > 0) {
    ctx.beginPath();
    roundRect(ctx, pipX, pipY, pipWidth, pipHeight, borderRadius);
    ctx.stroke();
  } else {
    ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
  }
});

/**
 * 3. mirrorFlip - 镜像翻转效果（翻书动画）
 * 模拟翻书/翻页的3D翻转过程，支持水平/垂直方向，可做360度连续翻转
 * 通过 scaleX 的 1→0→-1→0→1 循环模拟翻页透视
 */
visualEffects.set('mirrorFlip', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const axis = param(params, 'axis', 'horizontal');
  const intensity = param(params, 'intensity', 1.0, 0, 1);
  // 翻转角度：0~720度，控制翻书进度（默认180度=一次完整翻页）
  const flipAngle = param(params, 'flipAngle', 180, 0, 720);
  // 动画时间参数（由 VideoRenderer 注入，0~1 表示当前动画进度）
  const animProgress = param(params, 'progress', 0.5, 0, 1);

  const width = canvas.width;
  const height = canvas.height;

  // 计算实际翻转角度（结合静态角度 + 动画进度）
  const currentAngle = (flipAngle * animProgress) % 720;
  const radian = (currentAngle * Math.PI) / 180;

  // 保存原始图像到临时 canvas
  const sourceData = ctx.getImageData(0, 0, width, height);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  // 清空背景
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  ctx.save();

  if (axis === 'horizontal') {
    // 水平翻书：沿垂直中线像翻书一样翻转
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx, cy);

    // 核心翻转：scaleX 用 cos 模拟3D透视翻页
    const scaleX = Math.cos(radian) * intensity;
    // 翻页时的透视压缩：接近侧面时Y轴轻微压缩
    const perspectiveSqueeze = 0.85 + 0.15 * Math.abs(Math.cos(radian));
    ctx.scale(Math.abs(scaleX) < 0.001 ? 0.001 : scaleX, perspectiveSqueeze);
    ctx.drawImage(tempCanvas, -width / 2, -height / 2, width, height);

    // 翻页阴影效果
    const edgePhase = ((currentAngle % 180) / 180);
    if (edgePhase > 0.05 && edgePhase < 0.95) {
      const shadowAlpha = Math.sin(edgePhase * Math.PI) * 0.4 * intensity;
      const shadowOffset = (1 - Math.abs(scaleX)) * width * 0.15;
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fillRect(width / 2 + shadowOffset * 0.5, -height / 2,
        Math.max(2, shadowOffset * 0.8), height);
      ctx.strokeStyle = `rgba(255, 255, 255, ${shadowAlpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width / 2 + shadowOffset * 0.3, -height / 2);
      ctx.lineTo(width / 2 + shadowOffset * 0.3, height / 2);
      ctx.stroke();
    }

    // 背面内容
    if (scaleX < -0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.abs(scaleX)) * 0.85;
      ctx.filter = 'brightness(0.7) saturate(0.8)';
      ctx.scale(-1, 1);
      ctx.drawImage(tempCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

  } else if (axis === 'vertical') {
    // 垂直翻书：沿水平中线翻转
    const cx = width / 2;
    const cy = height / 2;
    ctx.translate(cx, cy);
    const scaleY = Math.cos(radian) * intensity;
    const perspectiveSqueeze = 0.85 + 0.15 * Math.abs(Math.cos(radian));
    ctx.scale(perspectiveSqueeze, Math.abs(scaleY) < 0.001 ? 0.001 : scaleY);
    ctx.drawImage(tempCanvas, -width / 2, -height / 2, width, height);

    const edgePhase = ((currentAngle % 180) / 180);
    if (edgePhase > 0.05 && edgePhase < 0.95) {
      const shadowAlpha = Math.sin(edgePhase * Math.PI) * 0.4 * intensity;
      const shadowOffset = (1 - Math.abs(scaleY)) * height * 0.15;
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fillRect(-width / 2, height / 2 + shadowOffset * 0.5,
        width, Math.max(2, shadowOffset * 0.8));
    }

    if (scaleY < -0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.abs(scaleY)) * 0.85;
      ctx.filter = 'brightness(0.7) saturate(0.8)';
      ctx.scale(1, -1);
      ctx.drawImage(tempCanvas, -width / 2, -height / 2, width, height);
      ctx.restore();
    }
  } else if (axis === 'quad') {
    // 四象限对称
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);
    const quads = [
      { sx: 0, sy: 0, dx: 0, dy: 0, fx: 1, fy: 1 },
      { sx: 0, sy: 0, dx: halfW, dy: 0, fx: -1, fy: 1 },
      { sx: 0, sy: 0, dx: 0, dy: halfH, fx: 1, fy: -1 },
      { sx: 0, sy: 0, dx: halfW, dy: halfH, fx: -1, fy: -1 },
    ];
    quads.forEach(q => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(q.dx, q.dy, halfW - (q.dx > 0 ? 1 : 0), halfH - (q.dy > 0 ? 1 : 0));
      ctx.clip();
      ctx.translate(q.fx === 1 ? 0 : q.dx + halfW, q.fy === 1 ? 0 : q.dy + halfH);
      ctx.scale(q.fx, q.fy);
      ctx.drawImage(tempCanvas, 0, 0, width, height);
      ctx.restore();
    });
    ctx.strokeStyle = `rgba(100, 180, 255, ${0.4 * intensity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(halfW, 0); ctx.lineTo(halfW, height);
    ctx.moveTo(0, halfH); ctx.lineTo(width, halfH);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.restore();

  // 角度指示器
  ctx.save();
  ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
  ctx.font = `${Math.max(11, Math.min(width, height) * 0.025)}px monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`FLIP ${Math.round(currentAngle)}°`, width - 8, height - 6);
  ctx.restore();
});

/**
 * 4. rotate - 旋转效果（带动画过程）
 * 对画面进行持续旋转动画，可设置目标角度和中心点
 * 动画过程中画面持续转动，有明确的视觉变化过程
 */
visualEffects.set('rotate', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  // 目标旋转角度（默认360度 = 一整圈）
  const angle = param(params, 'angle', 360, -720, 720);
  const pivotCenter = param(params, 'pivotCenter', true);
  // 动画进度参数（由 VideoRenderer 注入，0~1）
  const animProgress = param(params, 'progress', 0, 0, 1);

  const width = canvas.width;
  const height = canvas.height;

  // 当前帧的实际旋转角度 = 目标角度 × 动画进度
  const currentAngle = angle * animProgress;
  const radian = (currentAngle * Math.PI) / 180;

  // 保存原始图像
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空并填充背景
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // 应用旋转变换
  ctx.save();

  if (pivotCenter) {
    ctx.translate(width / 2, height / 2);
  } else {
    ctx.translate(param(params, 'pivotX', width / 2), param(params, 'pivotY', height / 2));
  }

  ctx.rotate(radian);
  ctx.translate(-width / 2, -height / 2);

  // 创建临时 canvas 绘制图像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.restore();

  // 旋转角度指示器（动态显示当前角度）
  ctx.save();
  ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
  ctx.font = `${Math.max(12, Math.min(width, height) * 0.03)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.round(currentAngle)}°`, width / 2, 8);
  ctx.restore();
});

/**
 * 5. zoomPan - 缩放推拉 (Ken Burns 效果)
 * 从画面正中心进行缩放与平移，为静态图像注入动感
 * 通过时间参数控制动画进度
 */
visualEffects.set('zoomPan', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const scaleStart = param(params, 'scaleStart', 1.0, 0.5, 2.0);
  const scaleEnd = param(params, 'scaleEnd', 1.25, 0.5, 2.5);
  const panX = param(params, 'panX', 0, -30, 30);
  const panY = param(params, 'panY', 0, -30, 30);
  // 动画进度（由 VideoRenderer 注入，0~1）
  const progress = param(params, 'progress', 0.5, 0, 1);
  // 是否启用缓动
  const easing = param(params, 'easing', true);

  const width = canvas.width;
  const height = canvas.height;

  // 保存原始图像
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空并填充黑色背景
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // 计算当前帧的插值值（带可选缓动）
  const t = easing
    ? progress * progress * (3 - 2 * progress) // smoothstep 缓动
    : progress;
  const currentScale = scaleStart + (scaleEnd - scaleStart) * t;
  const currentPanX = panX * t;
  const currentPanY = panY * t;

  // ===== 关键修复：以画面正中心为缩放/平移原点 =====
  ctx.save();

  // 第一步：移动到画面中心（这是缩放的原点）
  ctx.translate(width / 2, height / 2);

  // 第二步：应用缩放（以中心为基准等比缩放）
  ctx.scale(currentScale, currentScale);

  // 第三步：应用平移偏移（相对于中心位置）
  // panX/panY 是百分比，转换为像素偏移
  ctx.translate(
    (currentPanX / 100) * width,
    (currentPanY / 100) * height
  );

  // 第四步：将图像绘制原点移回左上角（因为 drawImage 从左上角绘制）
  ctx.translate(-width / 2, -height / 2);

  // 使用临时 canvas 绘制源图像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.restore();

  // Ken Burns 指示器
  ctx.save();
  ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
  ctx.font = `${Math.max(10, Math.min(width, height) * 0.02)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Ken Burns ${currentScale.toFixed(2)}x`, 6, height - 6);
  ctx.restore();
});

/**
 * 6. freezeFrame - 定格效果
 * 将某一帧冻结为静态画面，可设置定格时长后继续
 * 此效果需要在时间轴层面配合使用，这里提供视觉定格渲染
 */
visualEffects.set('freezeFrame', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const duration = param(params, 'duration', 1500, 200, 5000);
  const zoomEffect = param(params, 'zoomEffect', false);
  const zoomScale = param(params, 'zoomScale', 1.2, 1.0, 2.0);
  // frozenTime 表示已定格的时间比例 (0~1)
  const frozenProgress = param(params, 'frozenProgress', 0.5, 0, 1);

  const width = canvas.width;
  const height = canvas.height;

  // 保存原始图像作为定格帧
  const sourceData = ctx.getImageData(0, 0, width, height);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.save();

  if (zoomEffect) {
    // 缩放强调效果：定格期间缓慢放大
    const currentScale = 1 + (zoomScale - 1) * frozenProgress;
    ctx.translate(width / 2, height / 2);
    ctx.scale(currentScale, currentScale);
    ctx.translate(-width / 2, -height / 2);
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.restore();

  // 可选：添加定格指示边框
  if (frozenProgress > 0) {
    ctx.strokeStyle = `rgba(255, 200, 50, ${0.3 * frozenProgress})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
  }
});

/**
 * 7. reversePlay - 倒放效果
 * 模拟视频反向播放的视觉表现：水平方向时间逆转感
 * 结合水平镜像 + 轻微色偏(冷色调) + 可选运动拖尾
 */
visualEffects.set('reversePlay', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const speed = param(params, 'speed', 1.0, 0.25, 3.0);
  const audioReverse = param(params, 'audioReverse', false);

  const width = canvas.width;
  const height = canvas.height;

  // 保存原始图像
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空画布
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  // 水平翻转（模拟倒放的方向感）
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);

  // 使用临时 canvas 绘制翻转后的图像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.restore();

  // 添加轻微的冷色调偏移（暗示"倒退/回溯"感）
  if (speed >= 0.5) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const coolShift = Math.min(8, speed * 6);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, data[i] - coolShift);     // R 减弱
      data[i + 2] = Math.min(255, data[i + 2] + coolShift); // B 增强
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // 高速倒放时添加运动模糊效果
  if (Math.abs(speed) > 1.5) {
    ctx.fillStyle = 'rgba(200, 220, 255, 0.04)';
    ctx.fillRect(0, 0, width, height);
  }

  // 倒放指示标记（左上角小图标）
  ctx.save();
  ctx.fillStyle = 'rgba(180, 200, 255, 0.5)';
  ctx.font = `${Math.max(12, Math.min(width, height) * 0.03)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('\u25C0  REV', 6, 6);
  ctx.restore();
});

/**
 * 9. maskCrop - 蒙版裁切效果
 * 使用自定义形状（圆形/矩形/星形/心形）裁剪画面
 * 支持羽化边缘和反转遮罩
 */
visualEffects.set('maskCrop', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const shape = param(params, 'shape', 'ellipse');
  const feather = param(params, 'feather', 5, 0, 50);
  const invert = param(params, 'invert', false);

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;

  // 保存原始图像
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空画布
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = invert ? '#ffffff' : '#000000';
  ctx.fillRect(0, 0, width, height);

  // 创建形状路径
  ctx.save();
  ctx.beginPath();

  switch (shape) {
    case 'ellipse':
      ctx.ellipse(centerX, centerY, width * 0.42, height * 0.38, 0, 0, Math.PI * 2);
      break;

    case 'rectangle': {
      const margin = Math.min(width, height) * 0.08;
      ctx.rect(margin, margin, width - margin * 2, height - margin * 2);
      break;
    }

    case 'star':
      drawStarPath(ctx, centerX, centerY, 5, Math.min(width, height) * 0.45, Math.min(width, height) * 0.18);
      break;

    case 'heart':
      drawHeartPath(ctx, centerX, centerY, Math.min(width, height) * 0.35);
      break;

    default:
      ctx.ellipse(centerX, centerY, width * 0.42, height * 0.38, 0, 0, Math.PI * 2);
  }

  if (invert) {
    // 反转遮罩：用 evenodd 规则
    ctx.rect(0, 0, width, height);
    ctx.fillStyle = '#000000';
    ctx.fill('evenodd');
  }

  ctx.clip();

  // 绘制裁剪后的图像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  ctx.drawImage(tempCanvas, 0, 0, width, height);
  ctx.restore();

  // 羽化边缘效果（如果 feather > 0）
  if (feather > 0) {
    applyEdgeFeather(ctx, width, height, feather, !invert);
  }
});

/**
 * 10. montageStitch - 蒙太奇拼接效果
 * 将多画面网格拼接展示，支持多种布局模式
 * 注意：实际的多素材输入需由上层传入素材数组
 */
visualEffects.set('montageStitch', (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
) => {
  const layout = param(params, 'layout', 'grid-2x2');
  const gap = param(params, 'gap', 4, 0, 20);
  const animationSpeed = param(params, 'animationSpeed', 500, 100, 2000);
  // animProgress: 动画进度 0~1
  const animProgress = param(params, 'animProgress', 1, 0, 1);

  const width = canvas.width;
  const height = canvas.height;

  // 保存原始图像（用于演示：将同一图像复制到各格子）
  const sourceData = ctx.getImageData(0, 0, width, height);

  // 清空画布
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  // 创建临时 canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(sourceData, 0, 0);

  // 根据布局模式绘制网格
  switch (layout) {
    case 'grid-2x2': {
      const cellW = (width - gap * 3) / 2;
      const cellH = (height - gap * 3) / 2;
      drawMontageCell(ctx, tempCanvas, gap, gap, cellW, cellH, animProgress, 0);
      drawMontageCell(ctx, tempCanvas, gap + cellW + gap, gap, cellW, cellH, animProgress, 1);
      drawMontageCell(ctx, tempCanvas, gap, gap + cellH + gap, cellW, cellH, animProgress, 2);
      drawMontageCell(ctx, tempCanvas, gap + cellW + gap, gap + cellH + gap, cellW, cellH, animProgress, 3);
      break;
    }

    case 'row': {
      const cellW = (width - gap * 2) / 3;
      const cellH = height - gap * 2;
      for (let i = 0; i < 3; i++) {
        drawMontageCell(ctx, tempCanvas, gap + i * (cellW + gap), gap, cellW, cellH, animProgress, i);
      }
      break;
    }

    case 'column': {
      const cellW = width - gap * 2;
      const cellH = (height - gap * 3) / 3;
      for (let i = 0; i < 3; i++) {
        drawMontageCell(ctx, tempCanvas, gap, gap + i * (cellH + gap), cellW, cellH, animProgress, i);
      }
      break;
    }

    case 'collage': {
      // 拼贴式不规则布局
      const mainW = width * 0.55;
      const mainH = height * 0.7;
      drawMontageCell(ctx, tempCanvas, gap, gap, mainW - gap, mainH - gap, animProgress, 0);
      drawMontageCell(ctx, tempCanvas, mainW + gap, gap, width - mainW - gap * 2, height * 0.34, animProgress, 1);
      drawMontageCell(ctx, tempCanvas, mainW + gap, height * 0.36, width - mainW - gap * 2, height * 0.32, animProgress, 2);
      drawMontageCell(ctx, tempCanvas, gap, mainH + gap, width * 0.45 - gap, height - mainH - gap * 2, animProgress, 3);
      break;
    }

    default:
      ctx.drawImage(tempCanvas, 0, 0, width, height);
  }
});

// ============ 内部辅助函数 ============

/**
 * 绘制圆角矩形路径
 */
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
 * 绘制心形路径
 */
function drawHeartPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  const topY = cy - size * 0.4;
  ctx.moveTo(cx, topY + size * 0.3);
  ctx.bezierCurveTo(
    cx, topY - size * 0.3,
    cx - size, topY - size * 0.3,
    cx - size, topY + size * 0.1
  );
  ctx.bezierCurveTo(
    cx - size, topY + size * 0.6,
    cx, topY + size,
    cx, topY + size * 0.7
  );
  ctx.bezierCurveTo(
    cx, topY + size,
    cx + size, topY + size * 0.6,
    cx + size, topY + size * 0.1
  );
  ctx.bezierCurveTo(
    cx + size, topY - size * 0.3,
    cx, topY - size * 0.3,
    cx, topY + size * 0.3
  );
  ctx.closePath();
}

/**
 * 绘制蒙太奇单个单元格（带入场动画）
 */
function drawMontageCell(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  index: number
): void {
  // 错开每个格子的动画起始时间
  const delay = index * 0.12;
  // 修复：当 progress >= 1-delay 时，cellProgress 应达到 1（原公式在分母为负时出错）
  const rawProgress = progress > delay
    ? Math.min(1, (progress - delay) / Math.max(0.01, 1 - delay * 2))
    : 0;
  const cellProgress = Math.max(0, Math.min(1, rawProgress));

  if (cellProgress <= 0.001) return;

  ctx.save();

  // 入场动画：从中心缩放+淡入
  const scale = 0.8 + cellProgress * 0.2;
  const alpha = cellProgress;

  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);

  // 绘制带圆角的图像
  ctx.beginPath();
  roundRect(ctx, -2, -2, w + 4, h + 4, 4);
  ctx.clip();
  ctx.drawImage(source, -w / 2, -h / 2, w, h);

  ctx.restore();

  // 单元格边框
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

/**
 * 边缘羽化效果
 */
function applyEdgeFeather(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  feather: number,
  darkenEdge: boolean
): void {
  // 使用径向渐变叠加实现羽化
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.6
  );

  if (darkenEdge) {
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${feather / 100})`);
  } else {
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, `rgba(255, 255, 255, ${feather / 100})`);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * 十六进制颜色转 RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 255, b: 0 }; // 默认绿色
}

/**
 * RGB 转 HSL 色彩空间
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// ============ 导出便捷方法 ============

/**
 * 根据名称获取画面特效处理器
 */
export function getVisualEffect(name: string): VisualEffectProcessor | undefined {
  return visualEffects.get(name);
}

/**
 * 执行指定的画面特效
 */
export function applyVisualEffect(
  name: string,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  params?: Record<string, any>
): boolean {
  const processor = visualEffects.get(name);
  if (processor) {
    processor(ctx, canvas, params);
    return true;
  }
  console.warn(`[VisualEffects] 未知的画面特效: ${name}`);
  return false;
}

/** 所有可用的画面特效名称列表 */
export const visualEffectNames: string[] = [
  'splitScreen', 'pictureInPicture', 'mirrorFlip', 'rotate',
  'zoomPan', 'freezeFrame', 'reversePlay',
  'maskCrop', 'montageStitch'
];
