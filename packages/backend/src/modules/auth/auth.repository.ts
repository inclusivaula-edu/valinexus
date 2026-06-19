/**
 * auth.repository.ts
 *
 * Queries de banco exclusivas do módulo de auth.
 * Regra: nenhum outro módulo acessa a tabela users diretamente para
 * operações de autenticação — tudo passa por aqui.
 */

import { db } from '../../database/connection';
import { UserRole } from '@valinexus/shared';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  companyId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    role: row.role as UserRole,
    isActive: row.is_active as boolean,
    mustChangePassword: row.must_change_password as boolean,
  };
}

export const authRepository = {

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return result.rows.length > 0 ? mapUser(result.rows[0]) : null;
  },

  async findUserById(id: string): Promise<UserRecord | null> {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true LIMIT 1',
      [id]
    );
    return result.rows.length > 0 ? mapUser(result.rows[0]) : null;
  },

  async updateLastLogin(userId: string): Promise<void> {
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  },

  /**
   * Atualiza o hash da senha e limpa a flag must_change_password.
   * Chamado após a troca de senha bem-sucedida (primeiro acesso ou
   * troca voluntária pelo usuário nas configurações).
   */
  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await db.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = false
       WHERE id = $2`,
      [newPasswordHash, userId]
    );
  },

  /**
   * Salva o HASH do refresh token — nunca o token puro.
   * Se o banco vazar, os tokens não podem ser usados sem a chave original.
   */
  async saveRefreshToken(params: {
    userId: string;
    tokenPlain: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(params.tokenPlain)
      .digest('hex');

    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.userId, tokenHash, params.expiresAt, params.ipAddress ?? null, params.userAgent ?? null]
    );
  },

  /**
   * Valida o refresh token: busca pelo hash, verifica se não expirou
   * nem foi revogado. Retorna o user_id associado ou null.
   */
  async validateRefreshToken(tokenPlain: string): Promise<string | null> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(tokenPlain)
      .digest('hex');

    const result = await db.query(
      `SELECT user_id FROM refresh_tokens
       WHERE token_hash = $1
         AND expires_at > NOW()
         AND revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );
    return result.rows.length > 0 ? (result.rows[0].user_id as string) : null;
  },

  /** Revoga o token ao fazer logout — invalida a sessão imediatamente */
  async revokeRefreshToken(tokenPlain: string): Promise<void> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(tokenPlain)
      .digest('hex');

    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
  },

  /** Revoga TODAS as sessões do usuário — usado em "sair de todos os dispositivos" */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
  },

  /** Limpeza periódica de tokens expirados — chamada por cron semanal */
  async deleteExpiredTokens(): Promise<void> {
    await db.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL'
    );
  },
};
