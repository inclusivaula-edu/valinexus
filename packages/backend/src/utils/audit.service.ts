import { db } from '../database/connection';

export interface AuditEntry {
  userId: string;
  companyId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    await db.query(
      `INSERT INTO audit_log (user_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.userId,
        entry.companyId ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        JSON.stringify(entry.details ?? {}),
        entry.ipAddress ?? null,
      ]
    );
  },

  async listByCompany(companyId: string, limit = 50): Promise<AuditLogRow[]> {
    const result = await db.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_log al
       JOIN users u ON u.id = al.user_id
       WHERE al.company_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2`,
      [companyId, limit]
    );
    return result.rows.map(mapRow);
  },

  async listAll(limit = 100): Promise<AuditLogRow[]> {
    const result = await db.query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_log al
       JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapRow);
  },
};

export interface AuditLogRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): AuditLogRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    userEmail: row.user_email as string,
    companyId: row.company_id as string | null,
    action: row.action as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string | null,
    details: (row.details ?? {}) as Record<string, unknown>,
    ipAddress: row.ip_address as string | null,
    createdAt: (row.created_at as Date).toISOString(),
  };
}
