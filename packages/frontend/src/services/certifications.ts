/**
 * services/certifications.ts — Chamadas HTTP do módulo de certidões
 *
 * Centralizar as chamadas de API em um arquivo de serviço tem três vantagens:
 * 1. Os componentes não sabem a URL — se o endpoint mudar, muda aqui
 * 2. Tipagem forte: o retorno de cada função é tipado com as interfaces do shared
 * 3. Lógica de transformação de dados (snake_case → camelCase) fica aqui,
 *    não espalhada pelos componentes
 */

import { api } from './api';
import {
  Certification,
  CreateCertificationDto,
  UpdateCertificationDto,
  ApiResponse,
} from '@valinexus/shared';

export interface CertificationTemplate {
  id: string;
  name: string;
  category: string;
  issuingBody: string;
  typicalValidityDays: number;
  description: string | null;
  isMandatory: boolean;
}

export interface ExtractedDocData {
  certificationName: string | null;
  issuingBody: string | null;
  documentNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  category: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string | null;
}

export interface UploadResult {
  fileUrl: string;
  extracted: ExtractedDocData;
}

export interface DashboardData {
  certificationSummary: {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
    pendingUpload: number;
  };
  criticalAlerts: Certification[];
  upcomingExpirations: Certification[];
  complianceScore: number;
}

export const certificationsApi = {

  async list(): Promise<Certification[]> {
    const { data } = await api.get<ApiResponse<Certification[]>>('/certifications');
    return data.data;
  },

  async getDashboard(): Promise<DashboardData> {
    const { data } = await api.get<ApiResponse<DashboardData>>('/certifications/dashboard');
    return data.data;
  },

  async getTemplates(): Promise<CertificationTemplate[]> {
    const { data } = await api.get<ApiResponse<CertificationTemplate[]>>('/certifications/templates');
    return data.data;
  },

  async create(dto: CreateCertificationDto): Promise<Certification> {
    const { data } = await api.post<ApiResponse<Certification>>('/certifications', dto);
    return data.data;
  },

  async update(id: string, dto: UpdateCertificationDto): Promise<Certification> {
    const { data } = await api.patch<ApiResponse<Certification>>(`/certifications/${id}`, dto);
    return data.data;
  },

  async uploadFile(id: string, file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ApiResponse<UploadResult>>(
      `/certifications/${id}/upload`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/certifications/${id}`);
  },

  /**
   * Gera uma URL pré-assinada nova (válida por 15min) para o documento.
   * Chamar sempre antes de abrir o arquivo — a URL salva localmente
   * pode ter expirado.
   */
  async getDownloadUrl(id: string): Promise<string> {
    const { data } = await api.get<ApiResponse<{ url: string }>>(`/certifications/${id}/download-url`);
    return data.data.url;
  },
};
