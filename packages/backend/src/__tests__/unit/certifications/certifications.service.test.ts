/**
 * unit/certifications/certifications.service.test.ts
 *
 * Testa a lógica de negócio do serviço de certidões com repositório mockado.
 *
 * Cenários cobertos:
 * - Listar certidões por empresa
 * - Criar certidão (válida e com data vencida)
 * - Validação de tipo/tamanho no upload
 * - Dashboard: contagens e compliance score corretos
 * - syncAllStatuses: delega ao repositório corretamente
 */

import { certificationsService } from '../../../modules/certifications/certifications.service';
import { certificationsRepository } from '../../../modules/certifications/certifications.repository';
import { CertificationStatus, CertificationCategory } from '@valinexus/shared';
import {
  certificationFactory,
  expiredCertificationFactory,
  expiringSoonCertificationFactory,
  createCertificationDtoFactory,
  futureDate,
  pastDate,
} from '../../helpers/factories';

jest.mock('../../../modules/certifications/certifications.repository');
// Mock do db para o método getTemplates que acessa direto
jest.mock('../../../database/connection', () => ({
  db: { query: jest.fn() },
  withTransaction: jest.fn(),
}));

const mockRepo = certificationsRepository as jest.Mocked<typeof certificationsRepository>;

beforeEach(() => jest.clearAllMocks());

// ─── listByCompany ────────────────────────────────────────────────────────────

describe('certificationsService.listByCompany', () => {

  it('retorna lista de certidões da empresa', async () => {
    const certs = [certificationFactory(), certificationFactory()];
    mockRepo.findByCompanyId.mockResolvedValue(certs);

    const result = await certificationsService.listByCompany('company-123');

    expect(result).toEqual(certs);
    expect(mockRepo.findByCompanyId).toHaveBeenCalledWith('company-123');
  });

  it('retorna lista vazia quando empresa não tem certidões', async () => {
    mockRepo.findByCompanyId.mockResolvedValue([]);
    const result = await certificationsService.listByCompany('empresa-nova');
    expect(result).toHaveLength(0);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('certificationsService.create', () => {

  it('cria certidão com data futura sem erros', async () => {
    const dto = createCertificationDtoFactory({
      expiresAt: futureDate(180).toISOString(),
    });
    const created = certificationFactory({ name: dto.name });
    mockRepo.create.mockResolvedValue(created);

    const result = await certificationsService.create(dto);

    expect(result).toEqual(created);
    expect(mockRepo.create).toHaveBeenCalledWith(dto);
  });

  it('cria certidão com data passada (caso de registro histórico) — avisa mas não bloqueia', async () => {
    const dto = createCertificationDtoFactory({
      expiresAt: pastDate(5).toISOString(),
    });
    const created = expiredCertificationFactory();
    mockRepo.create.mockResolvedValue(created);

    // Não deve lançar erro — apenas logar aviso
    await expect(certificationsService.create(dto)).resolves.toBeDefined();
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
  });
});

// ─── uploadDocument ───────────────────────────────────────────────────────────

describe('certificationsService.uploadDocument', () => {

  const mockFile = (mimetype: string, size: number): Express.Multer.File => ({
    fieldname: 'file',
    originalname: 'certidao.pdf',
    encoding: '7bit',
    mimetype,
    size,
    buffer: Buffer.from(''),
    destination: '',
    filename: 'certidao.pdf',
    path: '',
    stream: null as never,
  });

  it('aceita PDF dentro do limite de tamanho', async () => {
    mockRepo.updateFileUrl.mockResolvedValue(undefined);
    const file = mockFile('application/pdf', 1024 * 1024); // 1MB

    const result = await certificationsService.uploadDocument('cert-123', file);

    expect(result.fileUrl).toContain('cert-123');
    // updateFileUrl agora recebe (id, fileUrl, s3Key) — s3Key vem do upload ao S3
    expect(mockRepo.updateFileUrl).toHaveBeenCalledWith(
      'cert-123',
      expect.any(String),
      expect.stringContaining('certifications/cert-123/')
    );
  });

  it('aceita imagens JPG e PNG', async () => {
    mockRepo.updateFileUrl.mockResolvedValue(undefined);

    for (const mime of ['image/jpeg', 'image/png']) {
      await expect(
        certificationsService.uploadDocument('cert-id', mockFile(mime, 500_000))
      ).resolves.toBeDefined();
    }
  });

  it('rejeita tipo de arquivo não suportado', async () => {
    const file = mockFile('application/zip', 1024);

    await expect(
      certificationsService.uploadDocument('cert-123', file)
    ).rejects.toThrow('Tipo de arquivo não suportado');

    expect(mockRepo.updateFileUrl).not.toHaveBeenCalled();
  });

  it('rejeita arquivo maior que 10MB', async () => {
    const file = mockFile('application/pdf', 11 * 1024 * 1024); // 11MB

    await expect(
      certificationsService.uploadDocument('cert-123', file)
    ).rejects.toThrow('Arquivo muito grande');

    expect(mockRepo.updateFileUrl).not.toHaveBeenCalled();
  });
});

// ─── getDashboard ─────────────────────────────────────────────────────────────

describe('certificationsService.getDashboard', () => {

  it('calcula summary corretamente com mix de status', async () => {
    const certs = [
      certificationFactory({ status: CertificationStatus.VALID }),
      certificationFactory({ status: CertificationStatus.VALID }),
      expiringSoonCertificationFactory(),
      expiredCertificationFactory(),
      certificationFactory({ status: CertificationStatus.PENDING_UPLOAD }),
    ];
    mockRepo.findByCompanyId.mockResolvedValue(certs);
    mockRepo.getComplianceScore.mockResolvedValue(40); // 2 válidas / 5 total

    const result = await certificationsService.getDashboard('company-123');

    expect(result.certificationSummary).toEqual({
      total: 5,
      valid: 2,
      expiringSoon: 1,
      expired: 1,
      pendingUpload: 1,
    });
    expect(result.complianceScore).toBe(40);
  });

  it('identifica alertas críticos (vencidas ou vencendo em ≤7 dias)', async () => {
    const certs = [
      expiredCertificationFactory(),                           // crítica: vencida
      expiringSoonCertificationFactory({ expiresAt: futureDate(5) }), // crítica: 5 dias
      certificationFactory({ expiresAt: futureDate(20) }),    // não crítica: 20 dias
    ];
    mockRepo.findByCompanyId.mockResolvedValue(certs);
    mockRepo.getComplianceScore.mockResolvedValue(33);

    const result = await certificationsService.getDashboard('company-123');

    expect(result.criticalAlerts).toHaveLength(2);
  });

  it('retorna summary zerado para empresa sem certidões', async () => {
    mockRepo.findByCompanyId.mockResolvedValue([]);
    mockRepo.getComplianceScore.mockResolvedValue(0);

    const result = await certificationsService.getDashboard('empresa-nova');

    expect(result.certificationSummary?.total).toBe(0);
    expect(result.certificationSummary?.valid).toBe(0);
    expect(result.criticalAlerts).toHaveLength(0);
  });
});

// ─── syncAllStatuses ──────────────────────────────────────────────────────────

describe('certificationsService.syncAllStatuses', () => {

  it('retorna contagem de expiradas e a expirar em breve', async () => {
    mockRepo.syncExpiredStatuses.mockResolvedValue(3);
    mockRepo.syncExpiringSoonStatuses.mockResolvedValue(7);

    const result = await certificationsService.syncAllStatuses();

    expect(result).toEqual({ expired: 3, expiringSoon: 7 });
    expect(mockRepo.syncExpiredStatuses).toHaveBeenCalledTimes(1);
    expect(mockRepo.syncExpiringSoonStatuses).toHaveBeenCalledTimes(1);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe('certificationsService.delete', () => {

  it('retorna true e não falha quando a certidão não tinha arquivo (s3Key null)', async () => {
    mockRepo.delete.mockResolvedValue({ deleted: true, s3Key: null });

    const result = await certificationsService.delete('cert-sem-arquivo');

    expect(result).toBe(true);
  });

  it('retorna true e tenta limpar o S3 quando a certidão tinha arquivo', async () => {
    mockRepo.delete.mockResolvedValue({
      deleted: true,
      s3Key: 'certifications/cert-123/1700000000-doc.pdf',
    });

    const result = await certificationsService.delete('cert-123');

    // Sem AWS configurada, s3Service.delete apenas loga — não lança erro
    expect(result).toBe(true);
  });

  it('retorna false quando a certidão não existe', async () => {
    mockRepo.delete.mockResolvedValue({ deleted: false, s3Key: null });

    const result = await certificationsService.delete('id-inexistente');

    expect(result).toBe(false);
  });
});

// ─── getDownloadUrl ───────────────────────────────────────────────────────────

describe('certificationsService.getDownloadUrl', () => {

  it('retorna null quando a certidão não tem arquivo (s3Key null)', async () => {
    mockRepo.getS3Key.mockResolvedValue(null);

    const result = await certificationsService.getDownloadUrl('cert-sem-arquivo');

    expect(result).toBeNull();
  });

  it('retorna uma URL contendo a s3Key quando existe arquivo', async () => {
    mockRepo.getS3Key.mockResolvedValue('certifications/cert-123/1700000000-doc.pdf');

    const result = await certificationsService.getDownloadUrl('cert-123');

    expect(result).toContain('certifications/cert-123/1700000000-doc.pdf');
  });
});
