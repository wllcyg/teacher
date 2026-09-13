import { create } from 'zustand'

interface AppState {
  currentClass: string
  classes: string[]
  setCurrentClass: (cls: string) => void
  setClasses: (list: string[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentClass: '八3班',
  classes: ['八3班', '八4班', '八9班', '八10班'],
  setCurrentClass: (cls) => set({ currentClass: cls }),
  setClasses: (list) => set({ classes: list }),
}))
