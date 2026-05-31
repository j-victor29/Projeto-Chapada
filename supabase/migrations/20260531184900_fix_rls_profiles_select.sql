-- ============================================================
-- MIGRATION DE CORREÇÃO: RLS SELECT NA TABELA profiles
-- 
-- DIAGNÓSTICO:
-- A migration inicial (20260519...) criou a policy "Users can view own profile"
-- com USING (auth.uid() = id), que permite ao usuário ver APENAS seu próprio
-- perfil. Isso bloqueia a página de Usuários, que precisa listar TODOS os perfis.
--
-- A migration definitiva (20260524170000) substituiu essa policy pela 
-- "Leitura de perfis por autenticados" com USING (true), mas pode não ter
-- sido aplicada corretamente em produção.
--
-- CORREÇÃO: Re-cria as policies corretas para profiles de forma idempotente.
-- ============================================================

-- 1. Remove todas as políticas SELECT existentes na tabela profiles
--    (para evitar conflitos com políticas legadas ou duplicadas)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Leitura de perfis por autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Permitir leitura de perfis para usuários autenticados" ON public.profiles;

-- 2. Cria a política correta: qualquer usuário autenticado pode ler todos os perfis
--    Isso é necessário para a página de Usuários funcionar (listagem da equipe)
CREATE POLICY "Leitura de perfis por autenticados"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. Garante que as demais políticas (INSERT/UPDATE/DELETE) também estão corretas
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Técnicos atualizam próprio perfil" ON public.profiles;
CREATE POLICY "Técnicos atualizam próprio perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Técnicos inserem próprio perfil" ON public.profiles;
CREATE POLICY "Técnicos inserem próprio perfil"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins excluem perfis" ON public.profiles;
CREATE POLICY "Admins excluem perfis"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 4. Garante que RLS está habilitado na tabela (segurança por padrão)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
