/**
 * companies.routes.ts
 *
 * Todas as rotas exigem SUPER_ADMIN — este módulo é o painel interno
 * da VALINEXUS, não algo que clientes acessam. Um COMPANY_ADMIN só
 * vê os dados da própria empresa através do módulo certifications,
 * nunca a lista de outras empresas.
 */

import { Router } from 'express';
import { z } from 'zod';
import { companiesController } from './companies.controller';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { CompanyStatus, PlanTier, UserRole } from '@valinexus/shared';

const router = Router();

const addressSchema = z.object({
  street: z.string().min(2, 'Endereço obrigatório'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().min(2, 'Bairro obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().length(2, 'UF deve ter 2 letras'),
  zipCode: z.string().min(8, 'CEP inválido'),
});

const createCompanySchema = z.object({
  body: z.object({
    cnpj: z.string().min(14, 'CNPJ inválido'),
    razaoSocial: z.string().min(3, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional(),
    email: z.string().email('E-mail inválido'),
    phone: z.string().min(8, 'Telefone inválido'),
    whatsapp: z.string().min(8, 'WhatsApp inválido'),
    address: addressSchema,
    serviceCategories: z.array(z.string()).default([]),
    planTier: z.nativeEnum(PlanTier).optional(),
  }),
});

const createWithAdminSchema = z.object({
  body: z.object({
    cnpj: z.string().min(14, 'CNPJ inválido'),
    razaoSocial: z.string().min(3, 'Razão social obrigatória'),
    nomeFantasia: z.string().optional(),
    email: z.string().email('E-mail inválido'),
    phone: z.string().min(8, 'Telefone inválido'),
    whatsapp: z.string().min(8, 'WhatsApp inválido'),
    address: addressSchema,
    serviceCategories: z.array(z.string()).default([]),
    planTier: z.nativeEnum(PlanTier).optional(),
    adminName: z.string().min(3, 'Nome do responsável obrigatório'),
    adminEmail: z.string().email('E-mail do responsável inválido'),
    adminPassword: z.string().min(8).optional(),
    applyDefaultTemplates: z.boolean().optional(),
  }),
});

const updateCompanySchema = z.object({
  body: z.object({
    razaoSocial: z.string().min(3).optional(),
    nomeFantasia: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().min(8).optional(),
    whatsapp: z.string().min(8).optional(),
    address: addressSchema.partial().optional(),
    serviceCategories: z.array(z.string()).optional(),
    planTier: z.nativeEnum(PlanTier).optional(),
    status: z.nativeEnum(CompanyStatus).optional(),
    crcPetrobrasCode: z.string().optional(),
  }),
});

// Todo o módulo é restrito à equipe VALINEXUS
router.use(authenticate, requireRole(UserRole.SUPER_ADMIN));

router.get('/', companiesController.list);
router.get('/:id', companiesController.getOne);
router.get('/:id/stats', companiesController.getUsageStats);
router.get('/:id/users', companiesController.listUsers);

router.post('/', validateRequest(createCompanySchema), companiesController.create);
router.post('/onboard', validateRequest(createWithAdminSchema), companiesController.createWithAdmin);

router.patch('/:id', validateRequest(updateCompanySchema), companiesController.update);
router.post('/:id/suspend', companiesController.suspend);
router.post('/:id/reactivate', companiesController.reactivate);

export { router as companiesRouter };
