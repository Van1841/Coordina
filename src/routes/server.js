// ============================================================
// src/routes/server.js
// Express server hosting the dashboard REST API + a Socket.IO
// live-activity stream. RTS signals are re-broadcast over the
// socket so the dashboard's activity feed updates in real time
// without polling — the same event-driven principle used
// internally for the agent (see rts/realtimeSearch.js).
// ============================================================
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from '../config/index.js';
import { router as dashboardApi } from './dashboardApi.js';
import { rts } from '../rts/realtimeSearch.js';
import makeLogger from '../utils/logger.js';

const log = makeLogger('server');

export function createServer() {
  const app = express();
  app.use(cors({ origin: config.dashboardOrigin }));
  app.use(express.json());
  app.use('/api', dashboardApi);

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.dashboardOrigin },
  });

  io.on('connection', (socket) => {
    log.debug('dashboard client connected:', socket.id);
    socket.on('disconnect', () => log.debug('dashboard client disconnected:', socket.id));
  });

  // Re-broadcast every RTS signal to connected dashboards live.
  rts.watch((signal) => {
    io.emit('signal', signal);
  });

  return { app, httpServer, io };
}

export function startServer() {
  const { httpServer } = createServer();
  httpServer.listen(config.port, () => {
    log.info(`Coordina API + live stream listening on http://localhost:${config.port}`);
  });
  return httpServer;
}
