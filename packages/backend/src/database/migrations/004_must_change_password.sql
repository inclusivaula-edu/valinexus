-- =============================================================================
-- Migration: 004_must_change_password.sql
--
-- Adiciona a coluna must_change_password à tabela users.
--
-- Contexto: o onboarding assistido (seed.ts) cria usuários com senhas
-- temporárias previsíveis (ex: "Acesso@2026!"), comunicadas ao cliente
-- via WhatsApp ou ligação. Sem um mecanismo de troca obrigatória, essa
-- senha temporária permaneceria válida indefinidamente — um risco de
-- segurança real, já que a senha trafega em texto puro por um canal
-- não criptografado (WhatsApp).
--
-- Com must_change_password = true:
-- - O login funciona normalmente (a senha temporária é válida)
-- - O frontend detecta a flag na resposta de /auth/me e força a tela
--   de troca de senha antes de liberar o dashboard
-- - Após a troca, a flag vira false e o usuário nunca mais é interrompido
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.must_change_password IS
  'Quando true, o frontend força a troca de senha antes de liberar o acesso ao painel. Usado para senhas temporárias geradas no onboarding.';
