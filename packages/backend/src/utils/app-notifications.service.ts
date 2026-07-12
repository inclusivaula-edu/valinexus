import { db } from '../database/connection';

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

export const appNotificationsService = {
  async create(params: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    certificationId?: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO app_notifications (user_id, title, message, type, certification_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.userId, params.title, params.message, params.type ?? 'info', params.certificationId ?? null]
    );
  },

  async createForCompanyUsers(params: {
    companyId: string;
    title: string;
    message: string;
    type?: string;
    certificationId?: string;
  }): Promise<void> {
    await db.query(
      `INSERT INTO app_notifications (user_id, title, message, type, certification_id)
       SELECT id, $2, $3, $4, $5 FROM users WHERE company_id = $1 AND is_active = true`,
      [params.companyId, params.title, params.message, params.type ?? 'info', params.certificationId ?? null]
    );
  },

  async listUnread(userId: string): Promise<AppNotification[]> {
    const result = await db.query(
      `SELECT * FROM app_notifications WHERE user_id = $1 AND read_at IS NULL ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return result.rows.map(mapRow);
  },

  async listAll(userId: string, limit = 30): Promise<AppNotification[]> {
    const result = await db.query(
      `SELECT * FROM app_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(mapRow);
  },

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE app_notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  },

  async markAllAsRead(userId: string): Promise<void> {
    await db.query(
      `UPDATE app_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
  },

  async countUnread(userId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM app_notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  },
};

function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    message: row.message as string,
    type: row.type as string,
    readAt: row.read_at ? (row.read_at as Date).toISOString() : null,
    certificationId: row.certification_id as string | null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}
