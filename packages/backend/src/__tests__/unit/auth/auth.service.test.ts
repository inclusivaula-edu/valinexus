/**
 * unit/auth/auth.service.test.ts
 *
 * Testa a lógica de autenticação SEM banco de dados.
 * O repositório é mockado — controlamos exatamente o que ele "retorna"
 * em cada cenário de teste.
 *
 * O que testamos aqui:
 * - Login com credenciais válidas → retorna tokens
 * - Login com email inexistente → erro genérico (não vaza "email não existe")
 * - Login com senha errada → mesmo erro genérico (timing-safe)
 * - Refresh com token válido → novo par de tokens
 * - Refresh com token inválido → erro
 * - Logout → revoga o token
 */

import { authService } from '../../../modules/auth/auth.service';
import { authRepository } from '../../../modules/auth/auth.repository';
import { UserRole } from '@valinexus/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock automático do repositório — nenhuma query real ao banco
jest.mock('../../../modules/auth/auth.repository');

const mockRepo = authRepository as jest.Mocked<typeof authRepository>;

// Usuário fictício que o repositório "retorna" nos testes
const MOCK_USER = {
  id: 'user-123',
  companyId: 'company-456',
  name: 'Responsável Técnico',
  email: 'admin@constramapa.com.br',
  passwordHash: '', // preenchido no beforeAll
  role: UserRole.COMPANY_ADMIN,
  isActive: true,
  mustChangePassword: false,
};

beforeAll(async () => {
  // Hash real da senha para os testes de login
  MOCK_USER.passwordHash = await bcrypt.hash('Senha@Correta123', 10);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Login ────────────────────────────────────────────────────────────────────

describe('authService.login', () => {

  it('retorna accessToken e refreshToken com credenciais válidas', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    mockRepo.updateLastLogin.mockResolvedValue(undefined);

    const result = await authService.login(
      'admin@constramapa.com.br',
      'Senha@Correta123',
      {}
    );

    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect(result.tokens.expiresIn).toBe(900); // 15 minutos em segundos
    expect(result.user.email).toBe('admin@constramapa.com.br');
    expect(result.user).not.toHaveProperty('passwordHash'); // nunca expor o hash
  });

  it('o accessToken contém o payload correto', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    mockRepo.updateLastLogin.mockResolvedValue(undefined);

    const result = await authService.login(
      'admin@constramapa.com.br',
      'Senha@Correta123',
      {}
    );

    const payload = jwt.decode(result.tokens.accessToken) as Record<string, unknown>;
    expect(payload.userId).toBe('user-123');
    expect(payload.companyId).toBe('company-456');
    expect(payload.role).toBe(UserRole.COMPANY_ADMIN);
  });

  it('lança erro EMAIL_OU_SENHA_INVALIDOS quando email não existe', async () => {
    // Repositório retorna null — email não encontrado
    mockRepo.findUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login('naoexiste@email.com', 'qualquersenha', {})
    ).rejects.toThrow('EMAIL_OU_SENHA_INVALIDOS');
  });

  it('lança erro EMAIL_OU_SENHA_INVALIDOS quando senha está errada', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);

    await expect(
      authService.login('admin@constramapa.com.br', 'SenhaErrada', {})
    ).rejects.toThrow('EMAIL_OU_SENHA_INVALIDOS');
  });

  it('salva o refresh token no banco após login bem-sucedido', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(MOCK_USER);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);
    mockRepo.updateLastLogin.mockResolvedValue(undefined);

    await authService.login('admin@constramapa.com.br', 'Senha@Correta123', {
      ipAddress: '127.0.0.1',
      userAgent: 'Jest Test',
    });

    expect(mockRepo.saveRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockRepo.saveRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Test',
      })
    );
  });

  it('passa o email para o repositório (normalização ocorre no repositório)', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null);

    try {
      await authService.login('ADMIN@CONSTRAMAPA.COM.BR', 'senha', {});
    } catch { /* esperado */ }

    // O service passa o email direto — o repositório é quem normaliza
    expect(mockRepo.findUserByEmail).toHaveBeenCalledWith('ADMIN@CONSTRAMAPA.COM.BR');
  });
});

// ─── Refresh ──────────────────────────────────────────────────────────────────

describe('authService.refresh', () => {

  it('retorna novo par de tokens com refresh token válido', async () => {
    mockRepo.validateRefreshToken.mockResolvedValue('user-123');
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    mockRepo.revokeRefreshToken.mockResolvedValue(undefined);
    mockRepo.saveRefreshToken.mockResolvedValue(undefined);

    const result = await authService.refresh('valid-refresh-token');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    // Rotação: o refresh token antigo deve ser revogado
    expect(mockRepo.revokeRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
    // E um novo deve ser salvo
    expect(mockRepo.saveRefreshToken).toHaveBeenCalledTimes(1);
  });

  it('lança REFRESH_TOKEN_INVALIDO quando token não existe no banco', async () => {
    mockRepo.validateRefreshToken.mockResolvedValue(null);

    await expect(
      authService.refresh('token-invalido')
    ).rejects.toThrow('REFRESH_TOKEN_INVALIDO');
  });

  it('lança USUARIO_NAO_ENCONTRADO quando usuário foi desativado após emissão do token', async () => {
    mockRepo.validateRefreshToken.mockResolvedValue('user-deletado');
    mockRepo.findUserById.mockResolvedValue(null); // usuário não existe mais

    await expect(
      authService.refresh('token-de-usuario-deletado')
    ).rejects.toThrow('USUARIO_NAO_ENCONTRADO');
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

describe('authService.logout', () => {

  it('revoga o refresh token', async () => {
    mockRepo.revokeRefreshToken.mockResolvedValue(undefined);

    await authService.logout('meu-refresh-token');

    expect(mockRepo.revokeRefreshToken).toHaveBeenCalledWith('meu-refresh-token');
  });
});

// ─── hashPassword ─────────────────────────────────────────────────────────────

describe('authService.hashPassword', () => {

  it('gera hash bcrypt válido', async () => {
    const hash = await authService.hashPassword('MinhaS3nha!');
    expect(hash).not.toBe('MinhaS3nha!');
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    // bcrypt.compare é assíncrono — verificamos o resultado
    const bcrypt = await import('bcryptjs');
    const match = await bcrypt.compare('MinhaS3nha!', hash);
    expect(match).toBe(true);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const hash1 = await authService.hashPassword('MesmaSenha!');
    const hash2 = await authService.hashPassword('MesmaSenha!');
    expect(hash1).not.toBe(hash2); // salt diferente → hash diferente
  });
});

// ─── changePassword ───────────────────────────────────────────────────────────

describe('authService.changePassword', () => {

  it('troca a senha com sucesso quando a senha atual está correta', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    mockRepo.updatePassword.mockResolvedValue(undefined);
    mockRepo.revokeAllUserTokens.mockResolvedValue(undefined);

    await authService.changePassword('user-123', 'Senha@Correta123', 'NovaSenh@456');

    expect(mockRepo.updatePassword).toHaveBeenCalledWith('user-123', expect.any(String));
    // O hash salvo deve ser diferente da senha em texto puro
    const savedHash = mockRepo.updatePassword.mock.calls[0][1];
    expect(savedHash).not.toBe('NovaSenh@456');
  });

  it('revoga todas as sessões após trocar a senha (segurança)', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);
    mockRepo.updatePassword.mockResolvedValue(undefined);
    mockRepo.revokeAllUserTokens.mockResolvedValue(undefined);

    await authService.changePassword('user-123', 'Senha@Correta123', 'NovaSenh@456');

    expect(mockRepo.revokeAllUserTokens).toHaveBeenCalledWith('user-123');
  });

  it('lança SENHA_ATUAL_INVALIDA quando a senha atual está errada', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(
      authService.changePassword('user-123', 'SenhaErrada', 'NovaSenh@456')
    ).rejects.toThrow('SENHA_ATUAL_INVALIDA');

    expect(mockRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('lança erro quando a nova senha é muito curta', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(
      authService.changePassword('user-123', 'Senha@Correta123', 'curta1')
    ).rejects.toThrow('mínimo 8 caracteres');

    expect(mockRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('lança erro quando a nova senha não tem número', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(
      authService.changePassword('user-123', 'Senha@Correta123', 'SoLetras')
    ).rejects.toThrow('número');
  });

  it('lança erro quando a nova senha não tem letra', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(
      authService.changePassword('user-123', 'Senha@Correta123', '12345678')
    ).rejects.toThrow('letra');
  });

  it('lança SENHA_IGUAL_A_ATUAL quando a nova senha é igual à atual', async () => {
    mockRepo.findUserById.mockResolvedValue(MOCK_USER);

    await expect(
      authService.changePassword('user-123', 'Senha@Correta123', 'Senha@Correta123')
    ).rejects.toThrow('SENHA_IGUAL_A_ATUAL');

    expect(mockRepo.updatePassword).not.toHaveBeenCalled();
  });

  it('lança USUARIO_NAO_ENCONTRADO quando o usuário não existe mais', async () => {
    mockRepo.findUserById.mockResolvedValue(null);

    await expect(
      authService.changePassword('user-deletado', 'qualquer', 'NovaSenh@456')
    ).rejects.toThrow('USUARIO_NAO_ENCONTRADO');
  });
});
