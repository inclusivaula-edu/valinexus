/**
 * certifications.repository.ts — Camada de acesso a dados
 *
 * Padrão Repository: toda query SQL do sistema fica aqui.
 * Os controllers NÃO fazem queries diretamente — eles chamam métodos
 * desse repositório. Isso tem três vantagens práticas:
 *
 * 1. Testabilidade: é fácil criar um "mock" desse repositório nos testes
 *    unitários sem precisar de um banco real.
 * 2. Reutilização: se dois controllers precisam da mesma query, eles
 *    chamam o mesmo método do repositório (DRY).
 * 3. Manutenção: quando mudar uma query, você muda em um lugar só.
 */

import { db } from '../../database/connection';
import {
  Certification,
  CertificationStatus,
  CreateCertificationDto,
  UpdateCertificationDto,
  computeCertificationStatus,
} from '@valinexus/shared';

// Mapeia snake_case do banco para camelCase do TypeScript.
// O banco de dados usa convenção SQL (snake_case), o TypeScript usa
// camelCase — esta função faz a ponte. Sem ela, você teria que escrever
// "certification.company_id" no frontend, o que vazaria detalhes do banco.
function mapRowToCertification(row: Record<string, unknown>): Certification {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    category: row.category as Certification['category'],
    issuingBody: row.issuing_body as string,
    documentNumber: row.document_number as string | null,
    issuedAt: row.issued_at ? new Date(row.issued_at as string) : null,
    expiresAt: new Date(row.expires_at as string),
    status: row.status as CertificationStatus,
    fileUrl: row.file_url as string | null,
    fileUploadedAt: row.file_uploaded_at ? new Date(row.file_uploaded_at as string) : null,
    notes: row.notes as string | null,
    alertsSent: [],  // carregado separadamente quando necessário
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const certificationsRepository = {

  async findByCompanyId(companyId: string): Promise<Certification[]> {
    const result = await db.query(
      `SELECT * FROM certifications
       WHERE company_id = $1
       ORDER BY expires_at ASC`,  // ordenado por vencimento: as mais urgentes primeiro
      [companyId]
    );
    return result.rows.map(mapRowToCertification);
  },

  async findById(id: string): Promise<Certification | null> {
    const result = await db.query(
      'SELECT * FROM certifications WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? mapRowToCertification(result.rows[0]) : null;
  },

  /**
   * Busca certidões que vencem em até `daysAhead` dias.
   * Usado pelo scheduler de alertas para encontrar o que precisa de notificação.
   *
   * O `NOW()::DATE` converte o timestamp atual para apenas a data (sem hora),
   * evitando problemas de timezone na comparação.
   */
  async findExpiringWithin(daysAhead: number): Promise<Certification[]> {
    const result = await db.query(
      `SELECT c.*, comp.whatsapp, comp.email, comp.razao_social
       FROM certifications c
       JOIN companies comp ON comp.id = c.company_id
       WHERE c.expires_at BETWEEN NOW()::DATE AND (NOW()::DATE + $1 * INTERVAL '1 day')
         AND c.status != 'EXPIRED'
         AND comp.status = 'ACTIVE'
       ORDER BY c.expires_at ASC`,
      [daysAhead]
    );
    return result.rows.map(mapRowToCertification);
  },

  async findExpired(): Promise<Certification[]> {
    const result = await db.query(
      `SELECT * FROM certifications
       WHERE expires_at < NOW()::DATE
         AND status != 'EXPIRED'`
    );
    return result.rows.map(mapRowToCertification);
  },

  async create(dto: CreateCertificationDto): Promise<Certification> {
    const result = await db.query(
      `INSERT INTO certifications
         (company_id, name, category, issuing_body, document_number,
          issued_at, expires_at, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dto.companyId,
        dto.name,
        dto.category,
        dto.issuingBody,
        dto.documentNumber ?? null,
        dto.issuedAt ?? null,
        dto.expiresAt,
        // Status inicial é derivado automaticamente da data de vencimento
        computeCertificationStatus(new Date(dto.expiresAt)),
        dto.notes ?? null,
      ]
    );
    return mapRowToCertification(result.rows[0]);
  },

  async update(id: string, dto: UpdateCertificationDto): Promise<Certification | null> {
    // Construção dinâmica do SET clause — apenas os campos que foram enviados
    // são atualizados. Evita sobrescrever campos não intencionalmente.
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (dto.name !== undefined)           { fields.push(`name = $${paramCount++}`);            values.push(dto.name); }
    if (dto.category !== undefined)       { fields.push(`category = $${paramCount++}`);        values.push(dto.category); }
    if (dto.issuingBody !== undefined)    { fields.push(`issuing_body = $${paramCount++}`);    values.push(dto.issuingBody); }
    if (dto.documentNumber !== undefined) { fields.push(`document_number = $${paramCount++}`); values.push(dto.documentNumber); }
    if (dto.issuedAt !== undefined)       { fields.push(`issued_at = $${paramCount++}`);       values.push(dto.issuedAt); }
    if (dto.notes !== undefined)          { fields.push(`notes = $${paramCount++}`);           values.push(dto.notes); }
    if (dto.status !== undefined)         { fields.push(`status = $${paramCount++}`);          values.push(dto.status); }

    if (dto.expiresAt !== undefined) {
      fields.push(`expires_at = $${paramCount++}`);
      values.push(dto.expiresAt);
      // Recalcular status automaticamente quando a data de vencimento muda
      fields.push(`status = $${paramCount++}`);
      values.push(computeCertificationStatus(new Date(dto.expiresAt)));
    }

    if (fields.length === 0) return this.findById(id); // nada a atualizar

    values.push(id);
    const result = await db.query(
      `UPDATE certifications SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows.length > 0 ? mapRowToCertification(result.rows[0]) : null;
  },

  async updateFileUrl(id: string, fileUrl: string, s3Key?: string): Promise<void> {
    await db.query(
      `UPDATE certifications
       SET file_url = $1,
           s3_key = COALESCE($2, s3_key),
           file_uploaded_at = NOW(),
           status = 'UNDER_REVIEW'
       WHERE id = $3`,
      [fileUrl, s3Key ?? null, id]
    );
  },

  /** Atualiza o status de todas as certidões vencidas — chamado pelo scheduler */
  async syncExpiredStatuses(): Promise<number> {
    const result = await db.query(
      `UPDATE certifications
       SET status = 'EXPIRED'
       WHERE expires_at < NOW()::DATE AND status != 'EXPIRED'`
    );
    return result.rowCount ?? 0;
  },

  /** Atualiza o status de certidões que vencem em 30 dias */
  async syncExpiringSoonStatuses(): Promise<number> {
    const result = await db.query(
      `UPDATE certifications
       SET status = 'EXPIRING_SOON'
       WHERE expires_at BETWEEN NOW()::DATE AND (NOW()::DATE + INTERVAL '30 days')
         AND status = 'VALID'`
    );
    return result.rowCount ?? 0;
  },

  async getS3Key(id: string): Promise<string | null> {
    const result = await db.query(
      'SELECT s3_key FROM certifications WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? (result.rows[0].s3_key as string | null) : null;
  },

  async delete(id: string): Promise<{ deleted: boolean; s3Key: string | null }> {
    // Busca a s3_key antes de deletar para poder limpar o arquivo no S3
    const keyResult = await db.query(
      'SELECT s3_key FROM certifications WHERE id = $1',
      [id]
    );
    const s3Key = keyResult.rows[0]?.s3_key ?? null;

    const result = await db.query(
      'DELETE FROM certifications WHERE id = $1',
      [id]
    );
    return { deleted: (result.rowCount ?? 0) > 0, s3Key };
  },

  /** Score de conformidade: % de certidões válidas sobre o total */
  async getComplianceScore(companyId: string): Promise<number> {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'VALID') AS valid_count,
         COUNT(*) AS total_count
       FROM certifications
       WHERE company_id = $1`,
      [companyId]
    );
    const { valid_count, total_count } = result.rows[0];
    if (parseInt(total_count) === 0) return 0;
    return Math.round((parseInt(valid_count) / parseInt(total_count)) * 100);
  },
};
