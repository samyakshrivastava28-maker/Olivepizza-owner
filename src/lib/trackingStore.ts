import { create } from 'zustand';

export interface TrackingState {
  location: { lat: number; lng: number; time: number; heading?: number | null } | null;
  debugData: any;
  setLocation: (loc: { lat: number; lng: number; time: number; heading?: number | null }) => void;
  setDebugData: (updater: (prev: any) => any) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  location: null,
  debugData: {},
  setLocation: (location) => set({ location }),
  setDebugData: (updater) => set((state) => ({ debugData: updater(state.debugData) }))
}));
