import { create } from 'zustand';

interface AppState {
  wsStatus: 'disconnected' | 'connecting' | 'connected';
  qrCodeUrl: string | null;
  pairingCode: string | null;
  setWsStatus: (status: AppState['wsStatus']) => void;
  setQrCodeUrl: (url: string | null) => void;
  setPairingCode: (code: string | null) => void;
  checkConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  wsStatus: 'disconnected',
  qrCodeUrl: null,
  pairingCode: null,
  setWsStatus: (status) => set({ wsStatus: status }),
  setQrCodeUrl: (url) => set({ qrCodeUrl: url }),
  setPairingCode: (code) => set({ pairingCode: code }),

  checkConnection: async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.isConnected) {
          set({ wsStatus: 'connected', qrCodeUrl: null, pairingCode: null });
        } else {
          set({ wsStatus: 'disconnected', qrCodeUrl: data.qrCode || null, pairingCode: data.pairingCode || null });
        }
      } else {
        set({ wsStatus: 'disconnected' });
      }
    } catch (e: any) {
      if (e.name !== 'TypeError' && !e.message?.includes("JSON")) {
        console.error("Connection check failed:", e);
      }
      set({ wsStatus: 'disconnected' });
    }
  },

  disconnect: async () => {
    await fetch('/api/whatsapp/logout', { method: 'POST' });
    set({ wsStatus: 'disconnected', qrCodeUrl: null, pairingCode: null });
  }
}));
