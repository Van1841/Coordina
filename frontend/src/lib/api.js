// ============================================================
// frontend/src/lib/api.js
// Thin fetch wrapper around the Coordina dashboard API, plus a
// Socket.IO connection for the live activity stream.
// ============================================================
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function get(path) {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  health: () => get('/health'),
  organizations: () => get('/organizations'),
  incidents: (params = {}) => get(`/incidents?${new URLSearchParams(params)}`),
  incident: (id) => get(`/incidents/${id}`),
  resolveIncident: (id) => post(`/incidents/${id}/resolve`),
  requestRecommendation: (id) => post(`/incidents/${id}/recommend`),
  resources: (params = {}) => get(`/resources?${new URLSearchParams(params)}`),
  recommendations: (params = {}) => get(`/recommendations?${new URLSearchParams(params)}`),
  stats: () => get('/stats'),
};

export function connectLiveStream(onSignal) {
  const socket = io(API_BASE, { transports: ['websocket'] });
  socket.on('signal', onSignal);
  return () => socket.disconnect();
}
