import { Request, Response, NextFunction } from 'express';
import { companiesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto, CreateCompanyWithAdminDto, CompanyStatus } from '@valinexus/shared';

function mapServiceError(err: unknown): { status: number; error: string } | null {
  if (!(err instanceof Error)) return null;
  switch (err.message) {
    case 'CNPJ_INVALIDO':
      return { status: 400, error: 'CNPJ inválido. Verifique os dígitos informados.' };
    case 'CNPJ_JA_CADASTRADO':
      return { status: 409, error: 'Já existe uma empresa cadastrada com este CNPJ.' };
    default:
      return null;
  }
}

export const companiesController = {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as CompanyStatus | undefined;
      const search = req.query.search as string | undefined;
      const companies = await companiesService.list({ status, search });
      res.json({ success: true, data: companies });
    } catch (err) { next(err); }
  },

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await companiesService.getById(req.params.id);
      if (!company) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
      }
      res.json({ success: true, data: company });
    } catch (err) { next(err); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: CreateCompanyDto = req.body;
      const company = await companiesService.create(dto);
      res.status(201).json({ success: true, data: company });
    } catch (err) {
      const mapped = mapServiceError(err);
      if (mapped) return res.status(mapped.status).json({ success: false, error: mapped.error });
      next(err);
    }
  },

  /**
   * POST /companies/onboard
   * Cadastro completo via painel admin: empresa + usuário admin numa operação.
   * Retorna a senha temporária em texto puro UMA ÚNICA VEZ nesta resposta —
   * o admin deve copiá-la e comunicar ao cliente imediatamente.
   */
  async createWithAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: CreateCompanyWithAdminDto = req.body;
      const result = await companiesService.createWithAdmin(dto);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      const mapped = mapServiceError(err);
      if (mapped) return res.status(mapped.status).json({ success: false, error: mapped.error });
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: UpdateCompanyDto = req.body;
      const updated = await companiesService.update(req.params.id, dto);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      const mapped = mapServiceError(err);
      if (mapped) return res.status(mapped.status).json({ success: false, error: mapped.error });
      next(err);
    }
  },

  async suspend(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await companiesService.suspend(req.params.id);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
      }
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  async reactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await companiesService.reactivate(req.params.id);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Empresa não encontrada' });
      }
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  async getUsageStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await companiesService.getUsageStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (err) { next(err); }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await companiesService.listUsers(req.params.id);
      res.json({ success: true, data: users });
    } catch (err) { next(err); }
  },
};
