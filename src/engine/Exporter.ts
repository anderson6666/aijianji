import type { AudioProcessor } from './AudioProcessor';
import type { ExportOptions, ProgressCallback, ExportStatus } from '../types';

/**
 * 导出模块 - 将编辑好的项目导出为视频文件
 * 使用 canvas.captureStream() + MediaRecorder 实现
 */
export class Exporter {
  private canvas: HTMLCanvasElement;
  private audioProcessor: AudioProcessor;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private status: ExportStatus = 'idle';
  private progressCallback: ProgressCallback | null = null;
  private isCancelled: boolean = false;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, audioProcessor: AudioProcessor) {
    this.canvas = canvas;
    this.audioProcessor = audioProcessor;
  }

  /**
   * 导出视频
   * @param options 导出选项
   * @returns Promise<Blob> 导出的视频文件
   */
  async export(options: ExportOptions): Promise<Blob> {
    if (this.status === 'exporting') {
      throw new Error('正在进行中的导出任务');
    }

    this.status = 'exporting';
    this.isCancelled = false;
    this.recordedChunks = [];

    try {
      // 获取 Canvas 视频流
      const stream = this.canvas.captureStream(options.fps);

      // 添加音频轨道（如果有）
      const audioStream = await this.getAudioStream();
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      }

      // 配置 MediaRecorder
      const mimeType = this.getSupportedMimeType(options.format);
      const recorderOptions: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: this.getBitrate(options),
      };

      return new Promise((resolve, reject) => {
        try {
          this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
        } catch (error) {
          reject(new Error(`创建 MediaRecorder 失败: ${error instanceof Error ? error.message : error}`));
          return;
        }

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: mimeType });

          if (this.isCancelled) {
            this.status = 'cancelled';
            reject(new Error('导出已取消'));
          } else {
            this.status = 'completed';
            resolve(blob);
          }
        };

        this.mediaRecorder.onerror = () => {
          this.status = 'error';
          reject(new Error('录制过程中发生错误'));
        };

        // 开始录制
        this.mediaRecorder.start(100); // 每100ms收集一次数据

        // 模拟进度更新（实际项目中应基于渲染帧数计算）
        this.simulateProgress(options);

      });
    } catch (error) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * 取消导出
   */
  cancel(): void {
    this.isCancelled = true;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.recordedChunks = [];
  }

  /**
   * 注册进度回调
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * 获取当前状态
   */
  getStatus(): ExportStatus {
    return this.status;
  }

  /**
   * 销毁导出器
   */
  destroy(): void {
    this.cancel();
    this.progressCallback = null;
  }

  /**
   * 获取音频流
   */
  private async getAudioStream(): Promise<MediaStream | null> {
    // 尝试从 AudioContext 创建音频输出流
    // 注意：浏览器对 AudioContext capture 的支持有限
    // 实际实现可能需要使用 MediaElementAudioSourceNode 或其他方案

    // 这里返回 null 表示暂不添加音频流
    // 在完整实现中，可以尝试使用 MediaStreamAudioDestinationNode
    return null;
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      webm: 'video/webm;codecs=vp9',
      mp4: 'video/mp4',
    };

    const preferredMime = mimeTypes[format] || mimeTypes.webm;

    // 检查是否支持该格式
    if (MediaRecorder.isTypeSupported(preferredMime)) {
      return preferredMime;
    }

    // 回退到更通用的格式
    const fallbackMimes = [
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const mime of fallbackMimes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }

    return ''; // 使用默认格式
  }

  /**
   * 根据选项计算比特率
   */
  private getBitrate(options: ExportOptions): number {
    if (options.videoBitrate) {
      return options.videoBitrate;
    }

    // 根据质量和分辨率自动计算
    const baseBitrates: Record<string, number> = {
      low: 1000000,
      medium: 2500000,
      high: 5000000,
    };

    const baseRate = baseBitrates[options.quality] ?? baseBitrates.medium;
    const pixelCount = options.width * options.height;

    // 基于分辨率调整比特率
    const referencePixels = 1920 * 1080; // Full HD
    const scaleFactor = Math.sqrt(pixelCount / referencePixels);

    return Math.round(baseRate * scaleFactor);
  }

  /**
   * 模拟进度更新
   * 注意：这是一个简化实现，真实场景中应该基于实际渲染的帧数计算进度
   */
  private simulateProgress(options: ExportOptions): void {
    let currentProgress = 0;

    const updateProgress = () => {
      if (this.isCancelled || this.status !== 'exporting') return;

      // 简单模拟：假设每秒增加一定进度
      // 实际实现中，这应该由外部渲染循环驱动并传入真实的进度值
      currentProgress += 1;

      if (currentProgress <= 100) {
        this.progressCallback?.(currentProgress);
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    // 启动进度更新
    this.animationFrameId = requestAnimationFrame(updateProgress);
  }
}
