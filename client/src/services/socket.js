import { io } from 'socket.io-client';

// In production (Vercel), VITE_API_URL must point to the Railway backend.
// In dev, it falls back to '' which connects to same-origin (via Vite proxy).
const SOCKET_URL = import.meta.env.VITE_API_URL || '';

console.log('[SOCKET] URL:', SOCKET_URL || '(using dev proxy / same-origin)');

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,

      // ── Transport: start with polling, upgrade to websocket ─────────
      // Pure websocket-only can fail behind some Railway/Vercel proxies.
      // Let Engine.IO negotiate the upgrade automatically.
      transports: ['polling', 'websocket'],

      // ── Reconnection strategy (like Zoom/Meet) ─────────────────────
      reconnection: true,
      reconnectionAttempts: 20,         // Try up to 20 times before giving up
      reconnectionDelay: 1000,          // Start with 1s delay
      reconnectionDelayMax: 10000,      // Cap at 10s between retries
      randomizationFactor: 0.5,         // Randomize to avoid thundering herd

      // ── Timeout: must match server pingTimeout ─────────────────────
      timeout: 60000,                   // Wait 60s for connection before failing
    });
  }
  return socket;
};

export const connectSocket = (token) => {
  const s = getSocket();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export default getSocket;
