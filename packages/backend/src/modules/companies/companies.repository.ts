/**
 * companies.repository.ts — Camada de acesso a dados
 *
 * Mesmo padrão dos outros módulos: toda query SQL fica aqui, controllers
 * e services nunca tocam o banco diretamente.
 *
 * O método createWithAdmin() é o coração deste módulo — substitui o
 * fluxo manual do seed.ts por uma operação atômica via transação:
 * se a criação do usuário falhar depois da empresa criada, a transação
 * inteira é revertida. Nunca existe uma empresa "órfã" sem usuário admin.
 */

import { db, withTransaction } from '../../database/connection';
import {
  Company,
  CompanyStatus,
  CreateCompanyDto,
  UpdateCompanyDto,
  PlanTier,
} from '@valinexus/shared';

function mapRowToCompany(row: Record<string, unknown>): Company {
  return {
    id: row.id as string,
    cnpj: row.cnpj as string,
    razaoSocial: row.razao_social as string,
    nomeFantasia: row.nome_fantasia as string | null,
    email: row.email as string,
    phone: row.phone as string,
    whatsapp: row.whatsapp as string,
    address: {
      street: row.address_street as string,
      number: row.address_number as string,
      complement: row.address_complement as string | null,
      neighborhood: row.address_neighborhood as string,
      city: row.address_city as string,
      state: row.address_state as string,
      zipCode: row.address_zip_code as string,
    },
    crcPetrobrasCode: row.crc_petrobras_code as string | null,
    crcRegisteredAt: row.crc_registered_at ? new Date(row.crc_registered_at as string) : null,
    status: row.status as CompanyStatus,
    planTier: row.plan_tier as PlanTier,
    planExpiresAt: new Date(row.plan_expires_at as string),
    serviceCategories: (row.service_categories as string[]) ?? [],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const companiesRepository = {

  async findAll(filters: { status?: CompanyStatus; search?: string } = {}): Promise<Company[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    // Plataforma interna (VALINEXUS Tecnologia, CNPJ 00.000.000/0001-00)
    // nunca aparece na listagem de clientes do admin
    conditions.push(`cnpj != '00.000.000/0001-00'`);

    if (filters.status) {
      conditions.push(`status = $${p++}`);
      values.push(filters.status);
    }
    if (filters.search) {
      conditions.push(`(razao_social ILIKE $${p} OR nome_fantasia ILIKE $${p} OR cnpj ILIKE $${p})`);
      values.push(`%${filters.search}%`);
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM companies ${where} ORDER BY created_at DESC`,
      values
    );
    return result.rows.map(mapRowToCompany);
  },

  async findById(id: string): Promise<Company | null> {
    const result = await db.query('SELECT * FROM companies WHERE id = $1', [id]);
    return result.rows.length > 0 ? mapRowToCompany(result.rows[0]) : null;
  },

  async findByCnpj(cnpj: string): Promise<Company | null> {
    const result = await db.query('SELECT * FROM companies WHERE cnpj = $1', [cnpj]);
    return result.rows.length > 0 ? mapRowToCompany(result.rows[0]) : null;
  },

  async create(dto: CreateCompanyDto): Promise<Company> {
    const result = await db.query(
      `INSERT INTO companies (
         cnpj, razao_social, nome_fantasia, email, phone, whatsapp,
         address_street, address_number, address_complement, address_neighborhood,
         address_city, address_state, address_zip_code,
         status, plan_tier, plan_expires_at, service_categories
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        dto.cnpj,
        dto.razaoSocial,
        dto.nomeFantasia ?? null,
        dto.email,
        dto.phone,
        dto.whatsapp,
        dto.address.street,
        dto.address.number,
        dto.address.complement ?? null,
        dto.address.neighborhood,
        dto.address.city,
        dto.address.state,
        dto.address.zipCode,
        CompanyStatus.PENDING_DOCS,
        dto.planTier ?? PlanTier.STARTER,
        // trial padrão de 30 dias a partir da criação
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        dto.serviceCategories,
      ]
    );
    return mapRowToCompany(result.rows[0]);
  },

  /**
   * Cria a empresa e o primeiro usuário (COMPANY_ADMIN) em uma única
   * transação. Se qualquer etapa falhar, tudo é revertido — garante que
   * nunca existe empresa sem usuário capaz de acessá-la.
   */
  async createWithAdmin(params: {
    company: CreateCompanyDto;
    adminName: string;
    adminEmail: string;
    adminPasswordHash: string;
  }): Promise<{ company: Company; userId: string }> {
    return withTransaction(async (client) => {
      const companyResult = await client.query(
        `INSERT INTO companies (
           cnpj, razao_social, nome_fantasia, email, phone, whatsapp,
           address_street, address_number, address_complement, address_neighborhood,
           address_city, address_state, address_zip_code,
           status, plan_tier, plan_expires_at, service_categories
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`,
        [
          params.company.cnpj,
          params.company.razaoSocial,
          params.company.nomeFantasia ?? null,
          params.company.email,
          params.company.phone,
          params.company.whatsapp,
          params.company.address.street,
          params.company.address.number,
          params.company.address.complement ?? null,
          params.company.address.neighborhood,
          params.company.address.city,
          params.company.address.state,
          params.company.address.zipCode,
          CompanyStatus.ACTIVE, // já entra ativa — onboarding assistido implica docs revisados
          params.company.planTier ?? PlanTier.STARTER,
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          params.company.serviceCategories,
        ]
      );
      const company = mapRowToCompany(companyResult.rows[0]);

      const userResult = await client.query(
        `INSERT INTO users (company_id, name, email, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, 'COMPANY_ADMIN', true)
         RETURNING id`,
        [company.id, params.adminName, params.adminEmail.toLowerCase().trim(), params.adminPasswordHash]
      );

      return { company, userId: userResult.rows[0].id as string };
    });
  },

  async update(id: string, dto: UpdateCompanyDto): Promise<Company | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (dto.razaoSocial !== undefined)       { fields.push(`razao_social = $${p++}`); values.push(dto.razaoSocial); }
    if (dto.nomeFantasia !== undefined)      { fields.push(`nome_fantasia = $${p++}`); values.push(dto.nomeFantasia); }
    if (dto.email !== undefined)             { fields.push(`email = $${p++}`); values.push(dto.email); }
    if (dto.phone !== undefined)             { fields.push(`phone = $${p++}`); values.push(dto.phone); }
    if (dto.whatsapp !== undefined)          { fields.push(`whatsapp = $${p++}`); values.push(dto.whatsapp); }
    if (dto.status !== undefined)            { fields.push(`status = $${p++}`); values.push(dto.status); }
    if (dto.planTier !== undefined)          { fields.push(`plan_tier = $${p++}`); values.push(dto.planTier); }
    if (dto.crcPetrobrasCode !== undefined)  { fields.push(`crc_petrobras_code = $${p++}`); values.push(dto.crcPetrobrasCode); }
    if (dto.serviceCategories !== undefined) { fields.push(`service_categories = $${p++}`); values.push(dto.serviceCategories); }

    if (dto.address) {
      if (dto.address.street !== undefined)       { fields.push(`address_street = $${p++}`); values.push(dto.address.street); }
      if (dto.address.number !== undefined)       { fields.push(`address_number = $${p++}`); values.push(dto.address.number); }
      if (dto.address.complement !== undefined)   { fields.push(`address_complement = $${p++}`); values.push(dto.address.complement); }
      if (dto.address.neighborhood !== undefined) { fields.push(`address_neighborhood = $${p++}`); values.push(dto.address.neighborhood); }
      if (dto.address.city !== undefined)         { fields.push(`address_city = $${p++}`); values.push(dto.address.city); }
      if (dto.address.state !== undefined)        { fields.push(`address_state = $${p++}`); values.push(dto.address.state); }
      if (dto.address.zipCode !== undefined)      { fields.push(`address_zip_code = $${p++}`); values.push(dto.address.zipCode); }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
      values
    );
    return result.rows.length > 0 ? mapRowToCompany(result.rows[0]) : null;
  },

  /**
   * Conta usuários e certidões vinculados, usado para alertar antes
   * de uma suspensão ou avaliar impacto de mudança de status.
   */
  async getUsageStats(companyId: string): Promise<{ userCount: number; certificationCount: number }> {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE company_id = $1) AS user_count,
         (SELECT COUNT(*) FROM certifications WHERE company_id = $1) AS cert_count`,
      [companyId]
    );
    return {
      userCount: parseInt(result.rows[0].user_count),
      certificationCount: parseInt(result.rows[0].cert_count),
    };
  },

  /** Aplica os templates padrão de certidão Petrobras a uma empresa recém-criada */
  async applyDefaultCertificationTemplates(companyId: string): Promise<number> {
    const result = await db.query(
      `INSERT INTO certifications (company_id, name, category, issuing_body, expires_at, status)
       SELECT
         $1,
         t.name,
         t.category,
         t.issuing_body,
         (NOW()::DATE + INTERVAL '1 day'),  -- prazo provisório de 1 dia: força aparecer como pendente até o cliente preencher a data real
         'PENDING_UPLOAD'
       FROM certification_templates t
       RETURNING id`,
      [companyId]
    );
    return result.rowCount ?? 0;
  },

  /** Lista os usuários de uma empresa — usado na tela de detalhe do admin */
  async listUsers(companyId: string): Promise<Array<{ id: string; name: string; email: string; role: string; isActive: boolean; mustChangePassword: boolean; lastLoginAt: Date | null }>> {
    const result = await db.query(
      `SELECT id, name, email, role, is_active, must_change_password, last_login_at
       FROM users WHERE company_id = $1 ORDER BY created_at ASC`,
      [companyId]
    );
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    }));
  },
};
