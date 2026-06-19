/**
 * services/companies.ts — Chamadas HTTP do módulo de empresas (admin)
 *
 * Consumido exclusivamente pelo painel SUPER_ADMIN. Um COMPANY_ADMIN
 * nunca chama essas rotas — o backend já bloqueia com 403, mas o
 * frontend nem oferece a tela para esse perfil (ver AdminGuard).
 */

import { api } from './api';
import {
  Company,
  CompanyStatus,
  CreateCompanyWithAdminDto,
  CreateCompanyWithAdminResult,
  UpdateCompanyDto,
  ApiResponse,
} from '@valinexus/shared';

export interface CompanyUsageStats {
  userCount: number;
  certificationCount: number;
}

export interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export const companiesApi = {

  async list(filters: { status?: CompanyStatus; search?: string } = {}): Promise<Company[]> {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const { data } = await api.get<ApiResponse<Company[]>>(`/companies?${params}`);
    return data.data;
  },

  async getById(id: string): Promise<Company> {
    const { data } = await api.get<ApiResponse<Company>>(`/companies/${id}`);
    return data.data;
  },

  async onboard(dto: CreateCompanyWithAdminDto): Promise<CreateCompanyWithAdminResult> {
    const { data } = await api.post<ApiResponse<CreateCompanyWithAdminResult>>('/companies/onboard', dto);
    return data.data;
  },

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const { data } = await api.patch<ApiResponse<Company>>(`/companies/${id}`, dto);
    return data.data;
  },

  async suspend(id: string): Promise<Company> {
    const { data } = await api.post<ApiResponse<Company>>(`/companies/${id}/suspend`);
    return data.data;
  },

  async reactivate(id: string): Promise<Company> {
    const { data } = await api.post<ApiResponse<Company>>(`/companies/${id}/reactivate`);
    return data.data;
  },

  async getUsageStats(id: string): Promise<CompanyUsageStats> {
    const { data } = await api.get<ApiResponse<CompanyUsageStats>>(`/companies/${id}/stats`);
    return data.data;
  },

  async listUsers(id: string): Promise<CompanyUser[]> {
    const { data } = await api.get<ApiResponse<CompanyUser[]>>(`/companies/${id}/users`);
    return data.data;
  },
};
