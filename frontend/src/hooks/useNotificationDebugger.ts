import { create } from 'zustand';

export interface DebugStep {
  step: string;
  status: 'started' | 'success' | 'failed' | 'error' | 'skipped';
  reason?: string;
  error?: string;
  trace?: any;
  orderId?: string;
  recipients?: number;
  email?: string;
  info?: any;
  lockOwner?: string;
  lockedAction?: string;
  lockAge?: string;
}

export interface DiagnosticTrace {
  route: string;
  action: string;
  orderId?: string;
  userId?: string;
  steps: DebugStep[];
  processingTime?: number;
}

interface NotificationDebuggerState {
  isOpen: boolean;
  isDebugMode: boolean; // Must be explicitly enabled
  activeTrace: DiagnosticTrace | null;
  
  toggleDebugMode: () => void;
  startTrace: (route: string, action: string, orderId?: string) => void;
  updateTrace: (trace: DiagnosticTrace) => void;
  appendStep: (step: DebugStep) => void;
  closeOverlay: () => void;
}

export const useNotificationDebugger = create<NotificationDebuggerState>((set, get) => ({
  isOpen: false,
  isDebugMode: false, // Disabled by default for production and standard operations
  activeTrace: null,

  toggleDebugMode: () => set((state) => ({ isDebugMode: !state.isDebugMode })),
  
  startTrace: (route, action, orderId) => {
    if (!get().isDebugMode) return;
    set({
      isOpen: true,
      activeTrace: { route, action, orderId, steps: [{ step: 'Initiated HTTP Request', status: 'started' }] }
    });
  },

  updateTrace: (trace) => set({ activeTrace: trace }),

  appendStep: (step) => set((state) => {
    if (!state.activeTrace) return state;
    return {
      activeTrace: {
        ...state.activeTrace,
        steps: [...state.activeTrace.steps, step]
      }
    };
  }),

  closeOverlay: () => set({ isOpen: false })
}));
