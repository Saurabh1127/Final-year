import { io } from 'socket.io-client';

// Connect directly to backend URL if specified in .env, otherwise fallback to same-origin proxy
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || '';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,

      // ── Transport: websocket only (skip polling upgrade dance) ──────
      // Using both ['websocket', 'polling'] causes an extra HTTP round-trip
      // for the upgrade. Over ngrok this adds latency and can drop the connection.
      transports: ['websocket'],

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
