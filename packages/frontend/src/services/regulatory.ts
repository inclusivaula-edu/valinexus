import { api } from './api';
import { ApiResponse } from '@valinexus/shared';

export interface RegulatoryChange {
  id: string;
  sourceUrl: string;
  sourceName: string;
  changeType: 'NEW_REQUIREMENT' | 'UPDATED_REQUIREMENT' | 'REMOVED_REQUIREMENT' | 'CONTENT_CHANGE';
  summary: string;
  detectedAt: string;
  reviewed: boolean;
  reviewedAt: string | null;
  actionTaken: string | null;
}

export const regulatoryApi = {
  async list(): Promise<RegulatoryChange[]> {
    const { data } = await api.get<ApiResponse<RegulatoryChange[]>>('/notifications/regulatory-changes');
    return data.data;
  },

  async markReviewed(id: string, actionTaken?: string): Promise<void> {
    await api.post(`/notifications/regulatory-changes/${id}/review`, { actionTaken });
  },
};
