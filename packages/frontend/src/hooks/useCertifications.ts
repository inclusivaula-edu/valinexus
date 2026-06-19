/**
 * hooks/useCertifications.ts — Hook de gerenciamento de certidões
 *
 * Este hook encapsula todo o ciclo de vida dos dados de certidões:
 * carregamento inicial, estados de loading/erro, e operações de CRUD.
 *
 * Por que hook e não Context?
 * Certidões são dados de "página" — só existem enquanto o dashboard está
 * montado. Não precisam de estado global. O hook é carregado, usa, descarta.
 * Context é para estado que persiste entre navegações (auth, preferências do usuário).
 *
 * O padrão "optimistic update" usado no delete:
 * Remove o item da UI imediatamente, sem esperar a API responder.
 * Se a API falhar, restaura o item. Resultado: a UI parece mais rápida.
 */

import { useState, useEffect, useCallback } from 'react';
import { Certification, CreateCertificationDto, UpdateCertificationDto } from '@valinexus/shared';
import { certificationsApi, DashboardData, CertificationTemplate } from '../services/certifications';

interface UseCertificationsReturn {
  certifications: Certification[];
  dashboard: DashboardData | null;
  templates: CertificationTemplate[];
  isLoading: boolean;
  error: string | null;
  create: (dto: CreateCertificationDto) => Promise<Certification>;
  update: (id: string, dto: UpdateCertificationDto) => Promise<Certification>;
  uploadFile: (id: string, file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCertifications(): UseCertificationsReturn {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [templates, setTemplates] = useState<CertificationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Carrega certidões, dashboard e templates em paralelo — 3x mais rápido
      // do que fazer em sequência
      const [certs, dash, tmpl] = await Promise.all([
        certificationsApi.list(),
        certificationsApi.getDashboard(),
        certificationsApi.getTemplates(),
      ]);
      setCertifications(certs);
      setDashboard(dash);
      setTemplates(tmpl);
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error ?? 'Erro ao carregar certidões';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (dto: CreateCertificationDto): Promise<Certification> => {
    const newCert = await certificationsApi.create(dto);
    // Adiciona no topo da lista sem recarregar tudo
    setCertifications(prev => [newCert, ...prev]);
    // Recarrega o dashboard para atualizar os contadores
    certificationsApi.getDashboard().then(setDashboard).catch(() => {});
    return newCert;
  }, []);

  const update = useCallback(async (id: string, dto: UpdateCertificationDto): Promise<Certification> => {
    const updated = await certificationsApi.update(id, dto);
    setCertifications(prev => prev.map(c => c.id === id ? updated : c));
    certificationsApi.getDashboard().then(setDashboard).catch(() => {});
    return updated;
  }, []);

  const uploadFile = useCallback(async (id: string, file: File): Promise<void> => {
    const { fileUrl } = await certificationsApi.uploadFile(id, file);
    // Atualiza só o fileUrl do item afetado — sem recarregar a lista inteira
    setCertifications(prev =>
      prev.map(c => c.id === id ? { ...c, fileUrl, status: 'UNDER_REVIEW' as Certification['status'] } : c)
    );
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    // Optimistic update: remove da UI antes da API confirmar
    const backup = certifications.find(c => c.id === id);
    setCertifications(prev => prev.filter(c => c.id !== id));
    try {
      await certificationsApi.delete(id);
      certificationsApi.getDashboard().then(setDashboard).catch(() => {});
    } catch (err) {
      // Rollback: restaura o item se a API falhou
      if (backup) setCertifications(prev => [...prev, backup]);
      throw err;
    }
  }, [certifications]);

  return {
    certifications,
    dashboard,
    templates,
    isLoading,
    error,
    create,
    update,
    uploadFile,
    remove,
    refresh: load,
  };
}
