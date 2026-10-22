import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from './api';

let socket: Socket | null = null;

export const getMobileSocket = (): Socket => {
  if (!socket) {
    const wsUrl = getBackendUrl();
    socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return socket;
};

export const resetMobileSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
