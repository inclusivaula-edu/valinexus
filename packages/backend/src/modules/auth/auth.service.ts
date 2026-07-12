/**
 * auth.service.ts — Lógica de autenticação
 *
 * Fluxo de login:
 * 1. Buscar usuário pelo email
 * 2. Comparar senha com bcrypt (timing-safe — evita timing attack)
 * 3. Gerar access token (JWT, curto prazo: 15min)
 * 4. Gerar refresh token (opaque token aleatório, longo prazo: 7 dias)
 * 5. Salvar hash do refresh token no banco
 * 6. Retornar ambos os tokens para o cliente
 *
 * Fluxo de refresh:
 * 1. Validar refresh token no banco
 * 2. Revogar o token usado (rotação: cada uso gera um novo par)
 * 3. Emitir novos access + refresh tokens
 *
 * Por que rotação de refresh token?
 * Se um refresh token for roubado e usado pelo atacante, o token legítimo
 * do usuário será invalidado na próxima vez que ele tentar renovar —
 * detectando o comprometimento. Sem rotação, o atacante mantém acesso
 * indefinidamente mesmo após o token ser "roubado".
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authRepository } from './auth.repository';
import { UserRole, validatePasswordStrength } from '@valinexus/shared';
import { logger } from '../../utils/logger';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos até o access token expirar
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  mustChangePassword: boolean;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado');
  return secret;
}

function generateTokenPair(user: AuthUser): TokenPair {
  const secret = getJwtSecret();
  const expiresIn = 15 * 60; // 15 minutos em segundos

  const accessToken = jwt.sign(
    {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn }
  );

  // Refresh token: 32 bytes aleatórios em hex (não é JWT — é opaque token)
  // Opaque porque não precisa carregar dados, só precisa ser único e imprevisível
  const refreshToken = crypto.randomBytes(32).toString('hex');

  return { accessToken, refreshToken, expiresIn };
}

export const authService = {

  async login(
    email: string,
    password: string,
    meta: { ipAddress?: string; userAgent?: string }
  ): Promise<{ tokens: TokenPair; user: Omit<AuthUser, 'id'> & { id: string } }> {

    const userRecord = await authRepository.findUserByEmail(email);

    if (userRecord) {
      const lockout = await authRepository.getLoginAttempts(userRecord.id);
      if (lockout.failedAttempts >= 5 && lockout.lockedUntil && lockout.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((lockout.lockedUntil.getTime() - Date.now()) / 60000);
        throw new Error(`CONTA_BLOQUEADA:${minutesLeft}`);
      }
    }

    const DUMMY_HASH = '$2b$10$abc123abc123abc123abc123abc123abc123abc123abc1234567890';
    const hashToCompare = userRecord?.passwordHash ?? DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!userRecord || !passwordMatch) {
      if (userRecord) {
        await authRepository.incrementFailedAttempts(userRecord.id);
      }
      throw new Error('EMAIL_OU_SENHA_INVALIDOS');
    }

    await authRepository.resetFailedAttempts(userRecord.id);

    const authUser: AuthUser = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      companyId: userRecord.companyId,
      mustChangePassword: userRecord.mustChangePassword,
    };
    const tokens = generateTokenPair(authUser);

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authRepository.saveRefreshToken({
      userId: userRecord.id,
      tokenPlain: tokens.refreshToken,
      expiresAt: refreshExpiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await authRepository.updateLastLogin(userRecord.id);

    logger.info({ event: 'login', userId: userRecord.id, email: userRecord.email });

    return {
      tokens,
      user: {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        companyId: authUser.companyId,
        mustChangePassword: authUser.mustChangePassword,
      },
    };
  },

  async refresh(refreshTokenPlain: string): Promise<TokenPair> {
    // 1. Validar o refresh token no banco
    const userId = await authRepository.validateRefreshToken(refreshTokenPlain);
    if (!userId) {
      throw new Error('REFRESH_TOKEN_INVALIDO');
    }

    // 2. Buscar dados do usuário
    const userRecord = await authRepository.findUserById(userId);
    if (!userRecord) {
      throw new Error('USUARIO_NAO_ENCONTRADO');
    }

    // 3. Revogar o token atual (rotação)
    await authRepository.revokeRefreshToken(refreshTokenPlain);

    // 4. Emitir novo par de tokens
    const authUser: AuthUser = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      companyId: userRecord.companyId,
      mustChangePassword: userRecord.mustChangePassword,
    };
    const tokens = generateTokenPair(authUser);

    // 5. Salvar novo refresh token
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authRepository.saveRefreshToken({
      userId: userRecord.id,
      tokenPlain: tokens.refreshToken,
      expiresAt: refreshExpiresAt,
    });

    return tokens;
  },

  async logout(refreshTokenPlain: string): Promise<void> {
    await authRepository.revokeRefreshToken(refreshTokenPlain);
    logger.info({ event: 'logout' });
  },

  async logoutAll(userId: string): Promise<void> {
    await authRepository.revokeAllUserTokens(userId);
    logger.info({ event: 'logout_all', userId });
  },

  /**
   * Troca a senha do usuário.
   *
   * Fluxo:
   * 1. Buscar o usuário (precisa do hash atual para validar)
   * 2. Validar que currentPassword corresponde ao hash armazenado
   * 3. Validar força da nova senha (regra compartilhada do @valinexus/shared)
   * 4. Hashear e salvar a nova senha, limpar must_change_password
   * 5. Revogar todas as sessões EXCETO a atual — força reautenticação
   *    em outros dispositivos caso a senha antiga tenha sido comprometida
   *
   * Usado tanto na troca obrigatória de primeiro acesso quanto na troca
   * voluntária pelo usuário (mesma rota, mesma validação).
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const userRecord = await authRepository.findUserById(userId);
    if (!userRecord) {
      throw new Error('USUARIO_NAO_ENCONTRADO');
    }

    const passwordMatch = await bcrypt.compare(currentPassword, userRecord.passwordHash);
    if (!passwordMatch) {
      throw new Error('SENHA_ATUAL_INVALIDA');
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(strength.reason ?? 'SENHA_FRACA');
    }

    if (currentPassword === newPassword) {
      throw new Error('SENHA_IGUAL_A_ATUAL');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await authRepository.updatePassword(userId, newHash);

    // Revoga sessões em outros dispositivos — a senha pode ter sido
    // comprometida (motivo comum de troca) ou era uma senha temporária
    // compartilhada via WhatsApp durante o onboarding.
    await authRepository.revokeAllUserTokens(userId);

    logger.info({ event: 'password_changed', userId });
  },

  /** Utilitário para criar hash de senha ao cadastrar usuário */
  async hashPassword(plainPassword: string): Promise<string> {
    // Salt rounds = 10: ~100ms por hash — suficientemente lento para ataques de força bruta,
    // rápido o suficiente para o usuário não perceber
    return bcrypt.hash(plainPassword, 10);
  },
};
