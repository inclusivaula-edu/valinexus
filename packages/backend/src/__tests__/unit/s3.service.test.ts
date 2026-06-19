/**
 * unit/s3.service.test.ts
 *
 * Testa o serviço S3 em modo "não configurado" (sem AWS_ACCESS_KEY_ID),
 * que é o estado padrão em ambiente de teste (setup.ts não define
 * credenciais AWS).
 *
 * Em modo não configurado:
 * - upload() não chama a AWS de verdade — retorna uma chave e URL mock
 * - delete() não chama a AWS — apenas loga
 * - getSignedUrl() retorna uma URL mock determinística
 *
 * Isso garante que o ambiente de desenvolvimento e os testes funcionam
 * sem precisar de uma conta AWS configurada.
 */

import { s3Service } from '../../utils/s3.service';

function mockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'certidao fgts (2026).pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 102_400,
    buffer: Buffer.from('conteudo-fake-do-pdf'),
    destination: '',
    filename: '',
    path: '',
    stream: null as never,
    ...overrides,
  };
}

beforeEach(() => {
  // Garante que AWS não está configurada nos testes
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
});

// ─── upload (modo local/mock) ─────────────────────────────────────────────────

describe('s3Service.upload (sem AWS configurada)', () => {

  it('retorna chave, fileUrl, bucket e size sem chamar a AWS', async () => {
    const result = await s3Service.upload('cert-123', mockFile());

    expect(result.key).toContain('certifications/cert-123/');
    expect(result.fileUrl).toContain('mock-s3.local');
    expect(result.bucket).toBeDefined();
    expect(result.size).toBe(102_400);
  });

  it('a chave inclui o nome do arquivo sanitizado', async () => {
    const result = await s3Service.upload('cert-123', mockFile({
      originalname: 'Certidão FGTS (2026).pdf',
    }));

    // Acentos e parênteses removidos, espaços substituídos por hífen
    expect(result.key).toMatch(/Certidao-FGTS-2026/);
    expect(result.key.endsWith('.pdf')).toBe(true);
  });

  it('a chave é única mesmo para o mesmo arquivo (timestamp)', async () => {
    const file = mockFile();
    const result1 = await s3Service.upload('cert-123', file);
    await new Promise(r => setTimeout(r, 5));
    const result2 = await s3Service.upload('cert-123', file);

    expect(result1.key).not.toBe(result2.key);
  });

  it('preserva a extensão do arquivo em diferentes formatos', async () => {
    const pdf = await s3Service.upload('c1', mockFile({ originalname: 'doc.pdf', mimetype: 'application/pdf' }));
    const jpg = await s3Service.upload('c1', mockFile({ originalname: 'foto.jpg', mimetype: 'image/jpeg' }));
    const png = await s3Service.upload('c1', mockFile({ originalname: 'scan.PNG', mimetype: 'image/png' }));

    expect(pdf.key.endsWith('.pdf')).toBe(true);
    expect(jpg.key.endsWith('.jpg')).toBe(true);
    expect(png.key.endsWith('.png')).toBe(true); // extensão normalizada para minúsculas
  });
});

// ─── getSignedUrl (modo local/mock) ───────────────────────────────────────────

describe('s3Service.getSignedUrl (sem AWS configurada)', () => {

  it('retorna URL mock contendo a chave', async () => {
    const key = 'certifications/cert-123/1234567890-documento.pdf';
    const url = await s3Service.getSignedUrl(key);

    expect(url).toContain(key);
    expect(url).toContain('mock=true');
  });
});

// ─── delete (modo local/mock) ─────────────────────────────────────────────────

describe('s3Service.delete (sem AWS configurada)', () => {

  it('resolve sem erro sem chamar a AWS', async () => {
    await expect(
      s3Service.delete('certifications/cert-123/arquivo.pdf')
    ).resolves.toBeUndefined();
  });
});

// ─── extractKey ───────────────────────────────────────────────────────────────

describe('s3Service.extractKey', () => {

  it('retorna a chave inalterada se já for uma chave', () => {
    const key = 'certifications/cert-123/1700000000-doc.pdf';
    expect(s3Service.extractKey(key)).toBe(key);
  });

  it('extrai a chave de uma URL completa', () => {
    const bucket = process.env.S3_BUCKET_NAME ?? 'valinexus-docs';
    const url = `https://${bucket}.s3.amazonaws.com/certifications/cert-123/1700000000-doc.pdf`;
    const key = s3Service.extractKey(url);

    expect(key).toBe('certifications/cert-123/1700000000-doc.pdf');
  });

  it('retorna a string original se não for uma URL válida nem chave conhecida', () => {
    const weird = 'nao-eh-nem-url-nem-chave';
    expect(s3Service.extractKey(weird)).toBe(weird);
  });
});
