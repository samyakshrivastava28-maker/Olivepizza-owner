import { create } from 'zustand';

interface LoadingState {
  activeTasks: Record<string, string>; // Maps taskId to optional message
  isLoading: boolean;
  currentMessage: string;
  startLoading: (taskId: string, message?: string) => void;
  stopLoading: (taskId: string) => void;
  clearAll: () => void;
}

// 300ms debounce before showing loader to prevent flicker
let startTimeoutId: ReturnType<typeof setTimeout> | null = null;
let maxTimeoutId: ReturnType<typeof setTimeout> | null = null;

export const useLoadingStore = create<LoadingState>((set) => ({
  activeTasks: {},
  isLoading: false,
  currentMessage: 'Baking your experience...',

  startLoading: (taskId: string, message = 'Baking your experience...') => {
    set((state) => {
      const newTasks = { ...state.activeTasks, [taskId]: message };
      
      if (!state.isLoading) {
        if (startTimeoutId) clearTimeout(startTimeoutId);
        startTimeoutId = setTimeout(() => {
          set({ isLoading: true, currentMessage: message });
          
          // Fallback maximum loading time: 10 seconds.
          // This ensures the loader NEVER gets stuck indefinitely.
          if (maxTimeoutId) clearTimeout(maxTimeoutId);
          maxTimeoutId = setTimeout(() => {
            set({ activeTasks: {}, isLoading: false });
          }, 10000);
          
        }, 300);
      }
      
      return { activeTasks: newTasks };
    });
  },

  stopLoading: (taskId: string) => {
    set((state) => {
      const newTasks = { ...state.activeTasks };
      delete newTasks[taskId];
      
      const hasTasks = Object.keys(newTasks).length > 0;
      
      if (!hasTasks) {
        if (startTimeoutId) {
          clearTimeout(startTimeoutId);
          startTimeoutId = null;
        }
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId);
          maxTimeoutId = null;
        }
        return { activeTasks: newTasks, isLoading: false };
      }
      
      // Update message to the next active task if available
      const nextMessage = Object.values(newTasks)[0] || 'Baking your experience...';
      return { activeTasks: newTasks, currentMessage: nextMessage };
    });
  },

  clearAll: () => {
    if (startTimeoutId) clearTimeout(startTimeoutId);
    if (maxTimeoutId) clearTimeout(maxTimeoutId);
    set({ activeTasks: {}, isLoading: false });
  }
}));
