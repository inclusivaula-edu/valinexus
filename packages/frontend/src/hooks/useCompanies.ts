/**
 * hooks/useCompanies.ts — Gerenciamento de estado do painel de empresas
 *
 * Mesmo padrão de useCertifications: carrega no mount, expõe operações
 * que atualizam o estado local sem precisar recarregar tudo do servidor.
 */

import { useState, useEffect, useCallback } from 'react';
import { Company, CompanyStatus, CreateCompanyWithAdminDto, CreateCompanyWithAdminResult } from '@valinexus/shared';
import { companiesApi } from '../services/companies';

interface UseCompaniesReturn {
  companies: Company[];
  isLoading: boolean;
  error: string | null;
  onboard: (dto: CreateCompanyWithAdminDto) => Promise<CreateCompanyWithAdminResult>;
  suspend: (id: string) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
  refresh: (filters?: { status?: CompanyStatus; search?: string }) => Promise<void>;
}

export function useCompanies(): UseCompaniesReturn {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filters: { status?: CompanyStatus; search?: string } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await companiesApi.list(filters);
      setCompanies(result);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao carregar empresas';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onboard = useCallback(async (dto: CreateCompanyWithAdminDto) => {
    const result = await companiesApi.onboard(dto);
    setCompanies(prev => [result.company, ...prev]);
    return result;
  }, []);

  const suspend = useCallback(async (id: string) => {
    const updated = await companiesApi.suspend(id);
    setCompanies(prev => prev.map(c => c.id === id ? updated : c));
  }, []);

  const reactivate = useCallback(async (id: string) => {
    const updated = await companiesApi.reactivate(id);
    setCompanies(prev => prev.map(c => c.id === id ? updated : c));
  }, []);

  return { companies, isLoading, error, onboard, suspend, reactivate, refresh: load };
}
