import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { NotificationItem } from '../services/notificationsApi';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? window.location.origin;

// Pass the current logged-in user's id and a callback for new notifications.
export function useNotificationSocket(
  userId: string | undefined,
  onNotification: (n: NotificationItem) => void,
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io(`${SOCKET_URL}/notifications`, {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', userId);
    });

    socket.on('notification:new', onNotification);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
