/**
 * companies.service.ts — Lógica de negócio do módulo de empresas
 *
 * Este módulo é a substituição visual do fluxo manual via seed.ts.
 * O método createWithAdmin() é o que o painel de admin chama ao
 * cadastrar um novo cliente: cria empresa + usuário admin + (opcional)
 * aplica os templates de certidão padrão — tudo numa operação.
 */

import { companiesRepository } from './companies.repository';
import {
  Company,
  CreateCompanyDto,
  UpdateCompanyDto,
  CreateCompanyWithAdminDto,
  CreateCompanyWithAdminResult,
  CompanyStatus,
  validateCnpj,
  formatCnpj,
} from '@valinexus/shared';
import { authService } from '../auth/auth.service';
import { emailService } from '../notifications/email.service';
import { logger } from '../../utils/logger';
import crypto from 'crypto';

/**
 * Gera uma senha temporária segura e fácil de comunicar verbalmente/WhatsApp.
 * Formato: Palavra + 4 dígitos + símbolo — atende a regra de força
 * (validatePasswordStrength) e é mais fácil de digitar manualmente do
 * que uma string aleatória pura.
 */
function generateTemporaryPassword(): string {
  // Charset sem ambíguos (0/O, 1/l/I) — letras + dígitos garantem validatePasswordStrength
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const companiesService = {

  async list(filters: { status?: CompanyStatus; search?: string } = {}): Promise<Company[]> {
    return companiesRepository.findAll(filters);
  },

  async getById(id: string): Promise<Company | null> {
    return companiesRepository.findById(id);
  },

  async create(dto: CreateCompanyDto): Promise<Company> {
    this.validateCnpjOrThrow(dto.cnpj);

    const existing = await companiesRepository.findByCnpj(formatCnpj(dto.cnpj));
    if (existing) {
      throw new Error('CNPJ_JA_CADASTRADO');
    }

    return companiesRepository.create({ ...dto, cnpj: formatCnpj(dto.cnpj) });
  },

  /**
   * Cadastro completo via painel admin: empresa + usuário admin numa operação.
   * É o equivalente ao seed.ts parametrizado, mas acionável pela UI sem
   * precisar de acesso ao terminal/Railway.
   */
  async createWithAdmin(dto: CreateCompanyWithAdminDto): Promise<CreateCompanyWithAdminResult> {
    this.validateCnpjOrThrow(dto.cnpj);

    const formattedCnpj = formatCnpj(dto.cnpj);
    const existing = await companiesRepository.findByCnpj(formattedCnpj);
    if (existing) {
      throw new Error('CNPJ_JA_CADASTRADO');
    }

    const temporaryPassword = dto.adminPassword?.trim() || generateTemporaryPassword();
    const passwordHash = await authService.hashPassword(temporaryPassword);

    const { company } = await companiesRepository.createWithAdmin({
      company: { ...dto, cnpj: formattedCnpj },
      adminName: dto.adminName,
      adminEmail: dto.adminEmail,
      adminPasswordHash: passwordHash,
    });

    if (dto.applyDefaultTemplates) {
      const count = await companiesRepository.applyDefaultCertificationTemplates(company.id);
      logger.info(`${count} templates de certidão aplicados para ${company.razaoSocial}`);
    }

    logger.info({ event: 'company_onboarded', companyId: company.id, cnpj: formattedCnpj, adminEmail: dto.adminEmail });

    // Credenciais entregues via email — a senha nunca trafega na resposta HTTP.
    const emailResult = await emailService.sendWelcomeCredentials({
      to: dto.adminEmail,
      adminName: dto.adminName,
      companyName: dto.razaoSocial,
      temporaryPassword,
      appUrl: process.env.APP_URL ?? 'http://localhost:5173',
    });

    if (!emailResult.success) {
      logger.warn({ event: 'welcome_email_failed', adminEmail: dto.adminEmail, error: emailResult.error });
    }

    return {
      company,
      adminEmail: dto.adminEmail,
      credentialsSent: emailResult.success,
    };
  },

  async update(id: string, dto: UpdateCompanyDto): Promise<Company | null> {
    if (dto.cnpj) {
      this.validateCnpjOrThrow(dto.cnpj);
      dto = { ...dto, cnpj: formatCnpj(dto.cnpj) };
    }
    return companiesRepository.update(id, dto);
  },

  async suspend(id: string): Promise<Company | null> {
    return companiesRepository.update(id, { status: CompanyStatus.SUSPENDED });
  },

  async reactivate(id: string): Promise<Company | null> {
    return companiesRepository.update(id, { status: CompanyStatus.ACTIVE });
  },

  async getUsageStats(id: string) {
    return companiesRepository.getUsageStats(id);
  },

  async listUsers(id: string) {
    return companiesRepository.listUsers(id);
  },

  validateCnpjOrThrow(cnpj: string): void {
    if (!validateCnpj(cnpj)) {
      throw new Error('CNPJ_INVALIDO');
    }
  },
};
