/**
 * certifications.routes.ts — Definição de rotas e validações
 *
 * A rota é a "porta de entrada" de cada endpoint. O padrão aqui é:
 * 1. Definir o verbo HTTP e o path
 * 2. Aplicar middleware de autenticação (authenticate)
 * 3. Aplicar middleware de validação (validateRequest com schema Zod)
 * 4. Chamar o controller
 *
 * Validar na rota, antes do controller, é importante porque:
 * - Rejeita requests malformadas antes de qualquer processamento
 * - Mantém os controllers limpos (sem `if (!req.body.name) return 400`)
 * - A mensagem de erro já chega formatada e específica para o cliente
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { certificationsController } from './certifications.controller';
import { certificationsExportController } from './certifications-export.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import { CertificationCategory } from '@valinexus/shared';

const router = Router();

const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.'));
    }
  },
});

// Schema Zod para criação de certidão — validação declarativa e tipada.
// Zod valida E infere o tipo TypeScript — escreve uma vez, valida em runtime.
const createCertificationSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
    category: z.nativeEnum(CertificationCategory, {
      errorMap: () => ({ message: 'Categoria inválida' }),
    }),
    issuingBody: z.string().min(2, 'Órgão emissor obrigatório'),
    documentNumber: z.string().optional(),
    issuedAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true, message: 'Data de vencimento inválida' }),
    notes: z.string().max(500).optional(),
  }),
});

const updateCertificationSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    category: z.nativeEnum(CertificationCategory).optional(),
    issuingBody: z.string().min(2).optional(),
    documentNumber: z.string().optional(),
    issuedAt: z.string().datetime({ offset: true }).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().max(500).optional(),
  }),
});

// Todas as rotas exigem autenticação
router.use(authenticate);

router.post('/extract', upload.single('file'), certificationsController.extractFromFile);
router.post('/extract-batch', upload.array('files', 10), certificationsController.extractBatch);
router.get('/export-pdf', certificationsExportController.exportPdf);
router.get('/search', certificationsController.search);

// GET /api/v1/certifications/templates
// Retorna as certidões-padrão exigidas pela Petrobras (seed do banco)
router.get('/templates', certificationsController.getTemplates);

// GET /api/v1/certifications/dashboard
// Dashboard com resumo e alertas da empresa do usuário logado
router.get('/dashboard', certificationsController.getDashboard);

// GET /api/v1/certifications
// Lista todas as certidões da empresa do usuário logado
router.get('/', certificationsController.list);

// GET /api/v1/certifications/:id
router.get('/:id', certificationsController.getOne);

// POST /api/v1/certifications
router.post(
  '/',
  validateRequest(createCertificationSchema),
  certificationsController.create
);

// PATCH /api/v1/certifications/:id
// PATCH em vez de PUT: atualização parcial — só os campos enviados são alterados
router.patch(
  '/:id',
  validateRequest(updateCertificationSchema),
  certificationsController.update
);

// POST /api/v1/certifications/:id/upload
// Endpoint separado para upload de arquivo — multipart/form-data
router.post('/:id/upload', upload.single('file'), certificationsController.uploadDocument);

// GET /api/v1/certifications/:id/download-url
// Gera URL pré-assinada nova (15min) para visualizar/baixar o documento
router.get('/:id/download-url', certificationsController.getDownloadUrl);

// DELETE /api/v1/certifications/:id
router.delete('/:id', certificationsController.delete);

export { router as certificationsRouter };
