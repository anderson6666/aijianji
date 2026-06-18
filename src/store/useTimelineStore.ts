import { create } from 'zustand'

interface TimelineState {
  // 滚动位置
  scrollLeft: number
  scrollTop: number

  // 轨道显示
  trackHeight: number
  headerWidth: number
  rulerHeight: number

  // 拖拽状态
  draggingClipId: string | null
  dragStartX: number
  dragStartY: number
  dragStartTime: number
  dragStartTrackId: string | null

  // 缩放状态
  pixelsPerSecond: number
  minPixelsPerSecond: number
  maxPixelsPerSecond: number

  // 播放头
  snapEnabled: boolean
  snapThreshold: number

  // 选区
  selectionStart: number | null
  selectionEnd: number | null

  // Actions
  setScrollLeft: (scrollLeft: number) => void
  setScrollTop: (scrollTop: number) => void
  setScroll: (scrollLeft: number, scrollTop: number) => void

  setTrackHeight: (height: number) => void
  setHeaderWidth: (width: number) => void
  setRulerHeight: (height: number) => void

  startDrag: (
    clipId: string,
    startX: number,
    startY: number,
    startTime: number,
    trackId: string
  ) => void
  endDrag: () => void
  updateDragPosition: (x: number, y: number) => void

  setPixelsPerSecond: (pps: number) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void

  toggleSnap: () => void
  setSnapThreshold: (threshold: number) => void

  setSelection: (start: number | null, end: number | null) => void
  clearSelection: () => void

  // 计算工具
  timeToPixel: (time: number) => number
  pixelToTime: (pixel: number) => number
}

const DEFAULT_TRACK_HEIGHT = 60
const DEFAULT_HEADER_WIDTH = 200
const DEFAULT_RULER_HEIGHT = 40
const MIN_PPS = 10
const MAX_PPS = 200
const DEFAULT_PPS = 50

const useTimelineStore = create<TimelineState>((set, get) => ({
  scrollLeft: 0,
  scrollTop: 0,

  trackHeight: DEFAULT_TRACK_HEIGHT,
  headerWidth: DEFAULT_HEADER_WIDTH,
  rulerHeight: DEFAULT_RULER_HEIGHT,

  draggingClipId: null,
  dragStartX: 0,
  dragStartY: 0,
  dragStartTime: 0,
  dragStartTrackId: null,

  pixelsPerSecond: DEFAULT_PPS,
  minPixelsPerSecond: MIN_PPS,
  maxPixelsPerSecond: MAX_PPS,

  snapEnabled: true,
  snapThreshold: 8,

  selectionStart: null,
  selectionEnd: null,

  setScrollLeft: (scrollLeft) => set({ scrollLeft: Math.max(0, scrollLeft) }),
  setScrollTop: (scrollTop) => set({ scrollTop: Math.max(0, scrollTop) }),
  setScroll: (scrollLeft, scrollTop) =>
    set({
      scrollLeft: Math.max(0, scrollLeft),
      scrollTop: Math.max(0, scrollTop),
    }),

  setTrackHeight: (height) => set({ trackHeight: Math.max(30, height) }),
  setHeaderWidth: (width) => set({ headerWidth: Math.max(100, width) }),
  setRulerHeight: (height) => set({ rulerHeight: Math.max(20, height) }),

  startDrag: (clipId, startX, startY, startTime, trackId) =>
    set({
      draggingClipId: clipId,
      dragStartX: startX,
      dragStartY: startY,
      dragStartTime: startTime,
      dragStartTrackId: trackId,
    }),

  endDrag: () =>
    set({
      draggingClipId: null,
      dragStartX: 0,
      dragStartY: 0,
      dragStartTime: 0,
      dragStartTrackId: null,
    }),

  updateDragPosition: (x, y) =>
    set({
      dragStartX: x,
      dragStartY: y,
    }),

  setPixelsPerSecond: (pps) =>
    set({
      pixelsPerSecond: Math.min(MAX_PPS, Math.max(MIN_PPS, pps)),
    }),

  zoomIn: () =>
    set((state) => ({
      pixelsPerSecond: Math.min(
        MAX_PPS,
        state.pixelsPerSecond * 1.25
      ),
    })),

  zoomOut: () =>
    set((state) => ({
      pixelsPerSecond: Math.max(
        MIN_PPS,
        state.pixelsPerSecond / 1.25
      ),
    })),

  resetZoom: () => set({ pixelsPerSecond: DEFAULT_PPS }),

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setSnapThreshold: (threshold) => set({ snapThreshold: threshold }),

  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  clearSelection: () => set({ selectionStart: null, selectionEnd: null }),

  timeToPixel: (time) => time * get().pixelsPerSecond,
  pixelToTime: (pixel) => pixel / get().pixelsPerSecond,
}))

export default useTimelineStore
