-- ============================================================
-- DIAGNÓSTICO E CORREÇÃO FINAL — BUGS 1 e 2
-- Execute os comandos abaixo UM POR UM no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- COMANDO 1: Verificar políticas RLS ativas nas duas tabelas
-- ─────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('profiles', 'tecnologias_sociais', 'projeto_tecnologias')
ORDER BY tablename, cmd;

-- ─────────────────────────────────────────────────────────────
-- COMANDO 2: Verificar se RLS está habilitado nas tabelas
-- ─────────────────────────────────────────────────────────────
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('profiles', 'tecnologias_sociais', 'projeto_tecnologias');

-- ─────────────────────────────────────────────────────────────
-- COMANDO 3: Verificar colunas reais da tabela profiles
-- (Confirma que a coluna é full_name, não nome_completo)
-- ─────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────
-- COMANDO 4 (corretivo): Garantir SELECT em tecnologias_sociais
-- Idempotente — pode rodar quantas vezes quiser
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.tecnologias_sociais;
CREATE POLICY "Leitura por autenticados"
ON public.tecnologias_sociais
FOR SELECT TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────
-- COMANDO 5 (corretivo): Garantir SELECT em projeto_tecnologias
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.projeto_tecnologias;
CREATE POLICY "Leitura por autenticados"
ON public.projeto_tecnologias
FOR SELECT TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────
-- COMANDO 6 (corretivo): Garantir SELECT em profiles
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Leitura de perfis por autenticados" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Leitura de perfis por autenticados"
ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────
-- COMANDO 7 (verificação final): Conferir usuários cadastrados
-- Confirma que a query do frontend vai retornar dados
-- ─────────────────────────────────────────────────────────────
SELECT id, email, full_name, role, updated_at
FROM public.profiles
ORDER BY full_name;
