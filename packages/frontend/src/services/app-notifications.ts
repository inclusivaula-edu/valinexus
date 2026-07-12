import { api } from './api';
import { ApiResponse } from '@valinexus/shared';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  certificationId: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export const appNotificationsApi = {
  async list(): Promise<NotificationsResponse> {
    const { data } = await api.get<ApiResponse<NotificationsResponse>>('/app-notifications');
    return data.data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await api.get<ApiResponse<{ count: number }>>('/app-notifications/unread-count');
    return data.data.count;
  },

  async markAsRead(id: string): Promise<void> {
    await api.post(`/app-notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.post('/app-notifications/mark-all-read');
  },
};
