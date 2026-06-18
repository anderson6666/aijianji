import type { AudioTrack } from '../types';

interface LoadedAudio {
  track: AudioTrack;
  audioBuffer: AudioBuffer;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
}

/**
 * 音频处理器 - 使用 Web Audio API 处理音频
 * 支持多音轨混音、音量控制、淡入淡出、混响效果和音频可视化
 */
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private loadedAudios: Map<string, LoadedAudio> = new Map();
  private convolverNode: ConvolverNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private isDestroyed: boolean = false;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    this.initAudioContext();
  }

  /**
   * 初始化音频上下文
   */
  private initAudioContext(): void {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 1;

    // 创建分析器节点用于可视化
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // 连接主链路：masterGain -> analyser -> destination
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // 初始化混响效果节点
    this.initReverbNodes();
  }

  /**
   * 初始化混响相关节点
   */
  private initReverbNodes(): void {
    if (!this.audioContext) return;

    this.convolverNode = this.audioContext.createConvolver();
    this.dryGain = this.audioContext.createGain();
    this.wetGain = this.audioContext.createGain();

    this.dryGain.gain.value = 1;
    this.wetGain.gain.value = 0;

    // 默认不连接混响，需要时动态连接
  }

  /**
   * 加载并解码音频文件
   */
  async loadAudio(url: string): Promise<void> {
    if (this.isDestroyed || !this.audioContext) {
      throw new Error('音频处理器已销毁');
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const track: AudioTrack = {
        id: url,
        url,
        volume: 1,
        startTime: 0,
        duration: audioBuffer.duration,
      };

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = track.volume;
      gainNode.connect(this.masterGain!);

      this.loadedAudios.set(url, {
        track,
        audioBuffer,
        sourceNode: null,
        gainNode,
      });
    } catch (error) {
      throw new Error(`加载音频失败: ${url} - ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * 播放音频
   * @param offset 播放偏移时间（秒）
   */
  play(offset?: number): void {
    if (this.isDestroyed || !this.audioContext) return;

    // 恢复音频上下文（浏览器自动播放策略）
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    const playOffset = offset ?? this.pausedAt;
    this.startTime = this.audioContext.currentTime - playOffset;
    this.pausedAt = 0;
    this.isPlaying = true;

    for (const [key, loaded] of this.loadedAudios) {
      this.playAudioSource(key, loaded, playOffset);
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.isDestroyed || !this.isPlaying) return;

    this.pausedAt = this.getCurrentTime();
    this.isPlaying = false;

    // 停止所有源节点
    for (const loaded of this.loadedAudios.values()) {
      if (loaded.sourceNode) {
        try {
          loaded.sourceNode.stop();
          loaded.sourceNode.disconnect();
        } catch {
          // 忽略已停止的源
        }
        loaded.sourceNode = null;
      }
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time: number): void {
    if (this.isDestroyed) return;

    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.pausedAt = time;
    if (wasPlaying) {
      this.play(time);
    }
  }

  /**
   * 设置主音量（0-1）
   */
  setVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 设置指定音轨的音量
   */
  setTrackVolume(trackId: string, volume: number): void {
    const loaded = this.loadedAudios.get(trackId);
    if (loaded) {
      loaded.gainNode.gain.value = Math.max(0, Math.min(1, volume));
      loaded.track.volume = volume;
    }
  }

  /**
   * 应用淡入效果
   * @param duration 淡入时长（秒）
   */
  applyFadeIn(duration: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const currentTime = this.audioContext.currentTime;
    this.masterGain.gain.setValueAtTime(0, currentTime);
    this.masterGain.gain.linearRampToValueAtTime(1, currentTime + duration);
  }

  /**
   * 应用淡出效果
   * @param duration 淡出时长（秒）
   */
  applyFadeOut(duration: number): void {
    if (!this.audioContext || !this.masterGain) return;

    const currentTime = this.audioContext.currentTime;
    const currentVolume = this.masterGain.gain.value;
    this.masterGain.gain.setValueAtTime(currentVolume, currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0, currentTime + duration);
  }

  /**
   * 应用混响效果
   * @param mix 混响混合比例（0-1），0为干声，1为湿声
   */
  applyReverb(mix: number): Promise<void> {
    if (!this.audioContext || !this.convolverNode || !this.dryGain || !this.wetGain) {
      return Promise.resolve();
    }

    mix = Math.max(0, Math.min(1, mix));
    this.dryGain.gain.value = 1 - mix;
    this.wetGain.gain.value = mix;

    // 如果还没有脉冲响应，生成一个简单的混响脉冲响应
    if (!this.convolverNode.buffer) {
      return this.generateImpulseResponse().then(buffer => {
        this.convolverNode!.buffer = buffer;
        this.reconnectWithReverb();
      });
    } else {
      this.reconnectWithReverb();
      return Promise.resolve();
    }
  }

  /**
   * 获取分析器数据用于可视化
   */
  getAnalyserData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(0);
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * 获取波形数据（时域）
   */
  getWaveformData(): Uint8Array {
    if (!this.analyser) {
      return new Uint8Array(0);
    }

    const dataArray = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * 获取当前播放时间
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return this.pausedAt;
    }
    return this.audioContext.currentTime - this.startTime;
  }

  /**
   * 是否正在播放
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 销毁音频处理器，释放资源
   */
  destroy(): void {
    this.isDestroyed = true;
    this.pause();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.loadedAudios.clear();
    this.audioContext = null;
    this.masterGain = null;
    this.analyser = null;
    this.convolverNode = null;
    this.dryGain = null;
    this.wetGain = null;
  }

  /**
   * 播放单个音频源
   */
  private playAudioSource(id: string, loaded: LoadedAudio, offset: number): void {
    if (!this.audioContext || !loaded.gainNode) return;

    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = loaded.audioBuffer;
    sourceNode.connect(loaded.gainNode);

    const trackOffset = loaded.track.startTime;
    const startOffset = Math.max(0, offset - trackOffset);

    if (startOffset < loaded.audioBuffer.duration) {
      sourceNode.start(0, startOffset);
      loaded.sourceNode = sourceNode;

      sourceNode.onended = () => {
        if (loaded.sourceNode === sourceNode) {
          loaded.sourceNode = null;
        }
      };
    }
  }

  /**
   * 生成简单的混响脉冲响应
   */
  private generateImpulseResponse(): Promise<AudioBuffer> {
    if (!this.audioContext) {
      return Promise.reject(new Error('音频上下文不存在'));
    }

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2秒的脉冲响应
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // 指数衰减的随机噪声模拟混响
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }

    return Promise.resolve(impulse);
  }

  /**
   * 重新连接音频节点以启用混响
   */
  private reconnectWithReverb(): void {
    if (!this.masterGain || !this.convolverNode || !this.dryGain || !this.wetGain) return;

    // 断开原有连接
    this.masterGain.disconnect();

    // masterGain -> dryGain -> analyser
    // masterGain -> convolver -> wetGain -> analyser
    this.dryGain.connect(this.analyser!);
    this.convolverNode.connect(this.wetGain);
    this.wetGain.connect(this.analyser!);

    this.masterGain.connect(this.dryGain);
    this.masterGain.connect(this.convolverNode);
  }
}
