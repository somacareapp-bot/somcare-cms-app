import axios from 'axios';

const API_BASE = '';

export interface NotificationItem {
  id: string;
  actorName?: string;
  actorAvatarUrl?: string;
  type: 'prescription' | 'appointment' | 'lab_result' | 'invoice' | 'system';
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
}

export const notificationsApi = {
  list: (userId: string, params?: { limit?: number; offset?: number; unreadOnly?: boolean }) =>
    axios
      .get<NotificationsResponse>(`${API_BASE}/api/notifications`, { params: { ...params, userId } })
      .then((r) => r.data),

  unreadCount: (userId: string) =>
    axios
      .get<{ unreadCount: number }>(`${API_BASE}/api/notifications/unread-count`, { params: { userId } })
      .then((r) => r.data),

  markRead: (userId: string, id: string) =>
    axios
      .patch<{ unreadCount: number }>(`${API_BASE}/api/notifications/${id}/read`, null, { params: { userId } })
      .then((r) => r.data),

  markAllRead: (userId: string) =>
    axios
      .patch<{ unreadCount: number }>(`${API_BASE}/api/notifications/read-all`, null, { params: { userId } })
      .then((r) => r.data),
};
