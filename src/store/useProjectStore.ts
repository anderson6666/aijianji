import { create } from 'zustand'
import type { Project, Material, Track, Clip, AppliedEffect } from '@/types'

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

function createDefaultProject(): Project {
  return {
    id: generateId(),
    name: '未命名项目',
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    tracks: [
      {
        id: generateId(),
        name: '视频轨道 1',
        type: 'video',
        clips: [],
        visible: true,
        locked: false,
        muted: false,
      },
      {
        id: generateId(),
        name: '音频轨道 1',
        type: 'audio',
        clips: [],
        visible: true,
        locked: false,
        muted: false,
      },
    ],
    materials: [],
    duration: 0,
  }
}

interface ProjectState {
  project: Project
  selectedClipId: string | null
  selectedTrackId: string | null
  selectedEffectId: string | null  // 当前选中的效果ID
  currentTime: number
  isPlaying: boolean
  zoom: number

  // 历史记录（用于撤销/重做）
  history: Project[]
  historyIndex: number
  maxHistorySize: number

  // Actions
  setProject: (project: Project) => void
  updateProjectName: (name: string) => void
  updateResolution: (width: number, height: number) => void
  updateFps: (fps: number) => void

  // 素材操作
  addMaterial: (material: Omit<Material, 'id'>) => string
  removeMaterial: (materialId: string) => void
  updateMaterial: (materialId: string, updates: Partial<Material>) => void

  // 轨道操作
  addTrack: (type: 'video' | 'audio' | 'effect', name?: string) => string
  removeTrack: (trackId: string) => void
  toggleTrackVisibility: (trackId: string) => void
  toggleTrackLock: (trackId: string) => void
  toggleTrackMute: (trackId: string) => void
  renameTrack: (trackId: string, name: string) => void

  // 片段操作
  addClip: (
    trackId: string,
    clip: Omit<Clip, 'id' | 'trackId'>
  ) => string
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void

  // 效果操作
  addEffectToClip: (clipId: string, effect: Omit<AppliedEffect, 'id'>) => string
  removeEffectFromClip: (clipId: string, effectId: string) => void
  updateEffectOnClip: (
    clipId: string,
    effectId: string,
    updates: Partial<AppliedEffect>
  ) => void

  // 选择与播放
  selectClip: (clipId: string | null) => void
  selectTrack: (trackId: string | null) => void
  selectEffect: (effectId: string | null) => void  // 选择效果
  setCurrentTime: (time: number) => void
  togglePlay: () => void
  setZoom: (zoom: number) => void

  // 撤销/重做
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // 工具方法
  getSelectedClip: () => Clip | undefined
  getSelectedTrack: () => Track | undefined
  recalculateDuration: () => void
}

const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  selectedClipId: null,
  selectedTrackId: null,
  selectedEffectId: null,
  currentTime: 0,
  isPlaying: false,
  zoom: 1,

  history: [createDefaultProject()],
  historyIndex: 0,
  maxHistorySize: 50,

  setProject: (project) =>
    set({ project, selectedClipId: null, selectedTrackId: null }),

  updateProjectName: (name) =>
    set((state) => {
      const updated = { ...state.project, name }
      return { project: updated }
    }),

  updateResolution: (width, height) =>
    set((state) => ({
      project: {
        ...state.project,
        resolution: { width, height },
      },
    })),

  updateFps: (fps) =>
    set((state) => ({ project: { ...state.project, fps } })),

  addMaterial: (material) => {
    const id = generateId()
    set((state) => ({
      project: {
        ...state.project,
        materials: [...state.project.materials, { ...material, id }],
      },
    }))
    return id
  },

  removeMaterial: (materialId) =>
    set((state) => ({
      project: {
        ...state.project,
        materials: state.project.materials.filter(
          (m) => m.id !== materialId
        ),
      },
    })),

  updateMaterial: (materialId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        materials: state.project.materials.map((m) =>
          m.id === materialId ? { ...m, ...updates } : m
        ),
      },
    })),

  addTrack: (type, name) => {
    const id = generateId()
    const trackCount =
      get().project.tracks.filter((t) => t.type === type).length + 1
    const defaultNames = {
      video: `视频轨道 ${trackCount}`,
      audio: `音频轨道 ${trackCount}`,
      effect: `效果轨道 ${trackCount}`,
    }

    const newTrack: Track = {
      id,
      name: name ?? defaultNames[type],
      type,
      clips: [],
      visible: true,
      locked: false,
      muted: false,
    }

    set((state) => ({
      project: {
        ...state.project,
        tracks: [...state.project.tracks, newTrack],
      },
    }))

    return id
  },

  removeTrack: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.filter((t) => t.id !== trackId),
      },
      selectedTrackId:
        state.selectedTrackId === trackId ? null : state.selectedTrackId,
    })),

  toggleTrackVisibility: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, visible: !t.visible } : t
        ),
      },
    })),

  toggleTrackLock: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: !t.locked } : t
        ),
      },
    })),

  toggleTrackMute: (trackId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, muted: !t.muted } : t
        ),
      },
    })),

  renameTrack: (trackId, name) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, name } : t
        ),
      },
    })),

  addClip: (trackId, clipData) => {
    const id = generateId()
    const clip: Clip = { ...clipData, id, trackId }

    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
        ),
      },
    }))

    get().recalculateDuration()
    return id
  },

  removeClip: (clipId) => {
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        })),
      },
      selectedClipId:
        state.selectedClipId === clipId ? null : state.selectedClipId,
    }))
    get().recalculateDuration()
  },

  updateClip: (clipId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? { ...c, ...updates } : c
          ),
        })),
      },
    })),

  moveClip: (clipId, newTrackId, newStartTime) => {
    let movedClip: Clip | null = null

    set((state) => {
      // 先从原轨道移除
      const newTracks = state.project.tracks.map((t) => {
        const clipIndex = t.clips.findIndex((c) => c.id === clipId)
        if (clipIndex !== -1) {
          movedClip = { ...t.clips[clipIndex], trackId: newTrackId, startTime: newStartTime }
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
        }
        return t
      })

      // 再添加到新轨道
      if (movedClip) {
        return {
          project: {
            ...state.project,
            tracks: newTracks.map((t) =>
              t.id === newTrackId
                ? { ...t, clips: [...t.clips, movedClip!] }
                : t
            ),
          },
        }
      }

      return { project: { ...state.project, tracks: newTracks } }
    })

    get().recalculateDuration()
  },

  addEffectToClip: (clipId, effectData) => {
    const id = generateId()
    const effect: AppliedEffect = { ...effectData, id }

    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? { ...c, effects: [...c.effects, effect] }
              : c
          ),
        })),
      },
    }))

    return id
  },

  removeEffectFromClip: (clipId, effectId) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  effects: c.effects.filter((e) => e.id !== effectId),
                }
              : c
          ),
        })),
      },
    })),

  updateEffectOnClip: (clipId, effectId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId
              ? {
                  ...c,
                  effects: c.effects.map((e) =>
                    e.id === effectId ? { ...e, ...updates } : e
                  ),
                }
              : c
          ),
        })),
      },
    })),

  selectClip: (clipId) => set({ selectedClipId: clipId, selectedEffectId: null }),

  selectTrack: (trackId) => set({ selectedTrackId: trackId }),

  selectEffect: (effectId) => set({ selectedEffectId: effectId }),

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(10, zoom)) }),

  pushHistory: () =>
    set((state) => {
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(JSON.parse(JSON.stringify(state.project)))

      if (newHistory.length > state.maxHistorySize) {
        newHistory.shift()
      }

      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      }
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return state
      const newIndex = state.historyIndex - 1
      return {
        project: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return state
      const newIndex = state.historyIndex + 1
      return {
        project: JSON.parse(JSON.stringify(state.history[newIndex])),
        historyIndex: newIndex,
      }
    }),

  getSelectedClip: () => {
    const state = get()
    for (const track of state.project.tracks) {
      const clip = track.clips.find((c) => c.id === state.selectedClipId)
      if (clip) return clip
    }
    return undefined
  },

  getSelectedTrack: () => {
    const state = get()
    return state.project.tracks.find((t) => t.id === state.selectedTrackId)
  },

  recalculateDuration: () =>
    set((state) => {
      let maxEnd = 0
      for (const track of state.project.tracks) {
        for (const clip of track.clips) {
          const end = clip.startTime + clip.duration
          if (end > maxEnd) maxEnd = end
        }
      }
      return {
        project: { ...state.project, duration: maxEnd },
      }
    }),
}))

export default useProjectStore
