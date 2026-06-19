import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';

const router = Router();

// Rate limit agressivo só no login: 10 tentativas por 15min por IP.
// Sem isso, um atacante pode tentar milhões de senhas (brute force).
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(1, 'Senha obrigatória'),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Senha atual obrigatória'),
    // Validação de força detalhada é feita no service (mensagens específicas
    // por regra). Aqui garantimos só o mínimo para não chegar string vazia.
    newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
  }),
});

router.post('/login',  loginRateLimit, validateRequest(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout',  authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.me);
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);

export { router as authRouter };
