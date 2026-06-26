/**
 * @valinexus/shared
 *
 * Este é o pacote central de tipos do sistema. Toda entidade, enum e
 * contrato de API é definido aqui UMA VEZ e importado tanto pelo backend
 * quanto pelo frontend. Isso elimina a categoria inteira de bugs onde o
 * frontend espera um campo que o backend não envia (ou vice-versa).
 *
 * Regra de ouro: se existe no banco de dados, existe aqui.
 */

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export enum CompanyStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',       // bloqueado no CRC
  PENDING_DOCS = 'PENDING_DOCS', // aguardando documentos
  INACTIVE = 'INACTIVE',
}

export enum CertificationStatus {
  VALID = 'VALID',
  EXPIRING_SOON = 'EXPIRING_SOON', // vence em <= 30 dias
  EXPIRED = 'EXPIRED',
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

export enum CertificationCategory {
  FISCAL = 'FISCAL',           // Receita Federal, PGFN, Estadual, Municipal
  TRABALHISTA = 'TRABALHISTA', // FGTS, CNDT
  SEGURANCA = 'SEGURANCA',    // NRs, PPRA, PCMSO, CIPA
  TECNICO = 'TECNICO',        // CREA, CAU, CRQ, ISO
  AMBIENTAL = 'AMBIENTAL',    // IBAMA, SEMA-AP, licenças
  OPERACIONAL = 'OPERACIONAL', // Alvará, licença de funcionamento
  PETROBRAS = 'PETROBRAS',    // CRC, certidão de cadastro, ASG
  SEGURO = 'SEGURO',          // apólices de seguro
}

export enum AlertSeverity {
  CRITICAL = 'CRITICAL', // vencida ou vence em <= 7 dias
  HIGH = 'HIGH',         // vence em 8–15 dias
  MEDIUM = 'MEDIUM',     // vence em 16–30 dias
  LOW = 'LOW',           // informativa
}

export enum AlertChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',   // equipe VALINEXUS
  COMPANY_ADMIN = 'COMPANY_ADMIN', // dono/admin da empresa cliente
  COMPANY_USER = 'COMPANY_USER',   // colaborador da empresa cliente
  VIEWER = 'VIEWER',               // acesso somente leitura
}

export enum PlanTier {
  STARTER = 'STARTER',           // R$ 490/mês
  PROFESSIONAL = 'PROFESSIONAL', // R$ 1.490/mês
  ENTERPRISE = 'ENTERPRISE',     // R$ 3.900/mês
}

// ─── ENTIDADES CORE ─────────────────────────────────────────────────────────

export interface Company {
  id: string;
  cnpj: string;               // formatado: XX.XXX.XXX/XXXX-XX
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string;
  phone: string;
  whatsapp: string;
  address: CompanyAddress;
  crcPetrobrasCode: string | null; // código no CRC Petrobras
  crcRegisteredAt: Date | null;
  status: CompanyStatus;
  planTier: PlanTier;
  planExpiresAt: Date;
  serviceCategories: string[];  // ex: ['transporte', 'manutencao']
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyAddress {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;          // ex: 'Macapá'
  state: string;         // ex: 'AP'
  zipCode: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface Certification {
  id: string;
  companyId: string;
  name: string;                   // ex: 'Certidão Negativa FGTS'
  category: CertificationCategory;
  issuingBody: string;            // ex: 'Caixa Econômica Federal'
  documentNumber: string | null;
  issuedAt: Date | null;
  expiresAt: Date;
  status: CertificationStatus;
  fileUrl: string | null;         // S3 URL do documento
  fileUploadedAt: Date | null;
  notes: string | null;
  alertsSent: CertificationAlert[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CertificationAlert {
  id: string;
  certificationId: string;
  severity: AlertSeverity;
  channel: AlertChannel;
  sentAt: Date;
  deliveredAt: Date | null;
  message: string;
}

// ─── DTOs (Data Transfer Objects) — Contratos de API ────────────────────────
// Esses tipos definem exatamente o que vai no body das requisições HTTP.
// Separar DTO da Entidade é importante: a Entidade tem campos internos
// (senhas hasheadas, createdAt, etc.) que não devem ser expostos na API.

export interface CreateCompanyDto {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: CompanyAddress;
  serviceCategories: string[];
  planTier?: PlanTier;
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {
  crcPetrobrasCode?: string;
  status?: CompanyStatus;
}

/**
 * DTO usado pelo painel de admin para cadastrar uma empresa-cliente
 * já com o primeiro usuário (COMPANY_ADMIN) em uma única operação.
 * Substitui o fluxo manual via seed.ts por linha de comando —
 * é o "onboarding assistido" feito pela UI em vez do terminal.
 *
 * O usuário criado sempre nasce com mustChangePassword=true, já que
 * a senha temporária é gerada/definida nesse momento e comunicada
 * ao cliente por fora do sistema (WhatsApp, ligação).
 */
export interface CreateCompanyWithAdminDto extends CreateCompanyDto {
  adminName: string;
  adminEmail: string;
  /** Senha temporária inicial. Se omitida, o backend gera uma aleatória. */
  adminPassword?: string;
  /** Se true, aplica os templates de certidão padrão Petrobras à empresa recém-criada. */
  applyDefaultTemplates?: boolean;
}

export interface CreateCompanyWithAdminResult {
  company: Company;
  adminEmail: string;
  /** Confirmação de que o email de boas-vindas foi enviado com as credenciais. */
  credentialsSent: boolean;
}

export interface CreateCertificationDto {
  companyId: string;
  name: string;
  category: CertificationCategory;
  issuingBody: string;
  documentNumber?: string;
  issuedAt?: string;    // ISO string — convertido para Date no backend
  expiresAt: string;    // ISO string — obrigatório
  notes?: string;
}

export interface UpdateCertificationDto extends Partial<Omit<CreateCertificationDto, 'companyId'>> {
  status?: CertificationStatus;
}

// ─── RESPONSES DA API ───────────────────────────────────────────────────────
// Envelope padrão para todas as respostas. Isso garante que o frontend
// sempre sabe a forma do dado que vai receber — sem surpresas.

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  details?: Record<string, string[]>; // erros de validação por campo
  statusCode: number;
}

// ─── TIPOS DE DASHBOARD ─────────────────────────────────────────────────────

export interface CompanyDashboard {
  company: Company;
  certificationSummary: {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
    pendingUpload: number;
  };
  criticalAlerts: Certification[]; // certidões vencidas ou a vencer em 7d
  upcomingExpirations: Certification[]; // próximas 30 dias
  complianceScore: number; // 0–100 — % de certidões válidas
}

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  totalCertifications: number;
  expiredCertifications: number;
  expiringSoonCertifications: number;
  alertsSentThisMonth: number;
}

// ─── UTILITÁRIOS ────────────────────────────────────────────────────────────

/** Calcula status da certidão com base na data de vencimento */
export function computeCertificationStatus(expiresAt: Date): CertificationStatus {
  const now = new Date();
  const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return CertificationStatus.EXPIRED;
  if (diffDays <= 30) return CertificationStatus.EXPIRING_SOON;
  return CertificationStatus.VALID;
}

/** Calcula severity do alerta com base em dias até o vencimento */
export function computeAlertSeverity(daysUntilExpiry: number): AlertSeverity {
  if (daysUntilExpiry <= 0) return AlertSeverity.CRITICAL;
  if (daysUntilExpiry <= 7) return AlertSeverity.CRITICAL;
  if (daysUntilExpiry <= 15) return AlertSeverity.HIGH;
  if (daysUntilExpiry <= 30) return AlertSeverity.MEDIUM;
  return AlertSeverity.LOW;
}

/** Formata CNPJ para exibição */
export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/** Valida CNPJ (algoritmo de dígito verificador) */
export function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // todos iguais

  const calcDigit = (d: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  return (
    calcDigit(digits, w1) === parseInt(digits[12]) &&
    calcDigit(digits, w2) === parseInt(digits[13])
  );
}

// ─── Senha ──────────────────────────────────────────────────────────────────

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Valida força mínima de senha: 8+ caracteres, ao menos 1 letra e 1 número.
 * Mesma regra usada no backend (Zod) e no frontend (feedback em tempo real) —
 * definida uma vez aqui para os dois lados nunca divergirem.
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) {
    return { valid: false, reason: 'A senha deve ter no mínimo 8 caracteres' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos uma letra' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'A senha deve conter ao menos um número' };
  }
  return { valid: true };
}

