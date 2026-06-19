import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { authRepository } from './auth.repository';

export const authController = {

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password, {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Refresh token vai em cookie httpOnly — nunca acessível via JavaScript.
      // Isso elimina a classe de ataque XSS que rouba tokens do localStorage.
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only em prod
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
        path: '/api/v1/auth', // cookie só enviado para rotas de auth
      });

      res.json({
        success: true,
        data: {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
          user: result.user,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_OU_SENHA_INVALIDOS') {
        return res.status(401).json({
          success: false,
          error: 'E-mail ou senha incorretos',
        });
      }
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      // Refresh token vem do cookie httpOnly — não do body
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
      }

      const tokens = await authService.refresh(refreshToken);

      // Rotação: atualiza o cookie com o novo refresh token
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'REFRESH_TOKEN_INVALIDO') {
        // Limpar o cookie inválido
        res.clearCookie('refreshToken', { path: '/api/v1/auth' });
        return res.status(401).json({ success: false, error: 'Sessão inválida. Faça login novamente.' });
      }
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logoutAll(req.user!.userId);
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      res.json({ success: true, data: null, message: 'Todas as sessões encerradas.' });
    } catch (err) {
      next(err);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, currentPassword, newPassword);

      // changePassword revoga todas as sessões (incluindo a atual) por segurança.
      // O frontend deve refazer login com a nova senha para obter tokens novos.
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });
      res.json({ success: true, data: null, message: 'Senha alterada com sucesso.' });
    } catch (err) {
      if (err instanceof Error && err.message === 'SENHA_ATUAL_INVALIDA') {
        return res.status(401).json({ success: false, error: 'Senha atual incorreta' });
      }
      if (err instanceof Error && err.message === 'SENHA_IGUAL_A_ATUAL') {
        return res.status(400).json({ success: false, error: 'A nova senha deve ser diferente da senha atual' });
      }
      if (err instanceof Error && (
        err.message.includes('mínimo') ||
        err.message.includes('letra') ||
        err.message.includes('número')
      )) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next(err);
    }
  },

  /**
   * Retorna os dados atuais do usuário logado.
   *
   * Importante: busca do BANCO, não apenas decodifica o JWT. O JWT tem
   * 15 minutos de validade e seu payload é fixo desde a emissão — se
   * `mustChangePassword` mudasse só no JWT, o frontend veria o valor
   * antigo até o próximo refresh. Buscando do banco, o estado é sempre atual.
   */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const userRecord = await authRepository.findUserById(req.user!.userId);
      if (!userRecord) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      }
      res.json({
        success: true,
        data: {
          userId: userRecord.id,
          companyId: userRecord.companyId,
          name: userRecord.name,
          email: userRecord.email,
          role: userRecord.role,
          mustChangePassword: userRecord.mustChangePassword,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
