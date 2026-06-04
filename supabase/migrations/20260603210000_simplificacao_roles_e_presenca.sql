-- ============================================================
-- MIGRATION: SIMPLIFICAÇÃO DE ROLES + CARGO + PRESENÇA
-- Sistema CHAPADA — todos os usuários são administradores
-- Idempotente: pode ser executada múltiplas vezes com segurança
-- ============================================================

-- ─── 1. REMOVER A CHECK CONSTRAINT DE ROLE (se existir) ─────────────────────
-- A constraint antiga impedia valores além de admin/editor/visualizador
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%role%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_constraint);
  END IF;
END$$;

-- ─── 2. GARANTIR COLUNA role COM DEFAULT 'admin' ─────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin';

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'admin';

-- Atualizar todos os registros existentes para 'admin'
UPDATE public.profiles
  SET role = 'admin'
  WHERE role IS NULL OR role != 'admin';

-- ─── 3. RECRIAR get_user_role() RETORNANDO SEMPRE 'admin' ───────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 4. RECRIAR is_admin() PARA SEMPRE RETORNAR TRUE ────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.uid() IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. REFORMULAR RLS DA TABELA profiles ────────────────────────────────────
-- Remover todas as políticas antigas
DROP POLICY IF EXISTS "Leitura de perfis por autenticados"    ON public.profiles;
DROP POLICY IF EXISTS "Técnicos atualizam próprio perfil"      ON public.profiles;
DROP POLICY IF EXISTS "Técnicos inserem próprio perfil"        ON public.profiles;
DROP POLICY IF EXISTS "Admins excluem perfis"                  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"             ON public.profiles;
DROP POLICY IF EXISTS "Autenticados podem ler"                 ON public.profiles;
DROP POLICY IF EXISTS "Autenticados podem inserir"             ON public.profiles;
DROP POLICY IF EXISTS "Autenticados podem atualizar"           ON public.profiles;
DROP POLICY IF EXISTS "Autenticados podem excluir"             ON public.profiles;

-- Criar políticas simples: autenticado = acesso total
CREATE POLICY "Autenticados podem ler"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados podem inserir"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados podem excluir"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (true);

-- ─── 6. REFORMULAR RLS DAS DEMAIS TABELAS PRINCIPAIS ─────────────────────────
-- Todas as tabelas: qualquer autenticado tem acesso total (INSERT/UPDATE/DELETE)
DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY[
    'tecnologias_sociais', 'projetos', 'projeto_tecnologias',
    'beneficiarios', 'atividades', 'atividade_beneficiarios',
    'atividade_tecnologias', 'arquivos_midia', 'auditoria',
    'linhas_de_acao', 'municipios', 'comunidades', 'financiadores',
    'categorias', 'publicos', 'projeto_municipios'
  ];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Remover políticas antigas
      EXECUTE format('DROP POLICY IF EXISTS "Leitura por autenticados"           ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Insercao por autenticados"          ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Edicao por autenticados"            ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins"         ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Insercao por admin/editor"          ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Edicao por admin/editor"            ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Admins criam linhas de acao"        ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Admins editam linhas de acao"       ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Admins deletam linhas de acao"      ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Leitura de linhas de acao por autenticados" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Autenticados podem ler"             ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Autenticados podem inserir"         ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Autenticados podem atualizar"       ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Autenticados podem excluir"         ON public.%I', t);

      -- Criar políticas simples
      EXECUTE format(
        'CREATE POLICY "Autenticados podem ler" ON public.%I FOR SELECT TO authenticated USING (true)', t
      );
      EXECUTE format(
        'CREATE POLICY "Autenticados podem inserir" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t
      );
      EXECUTE format(
        'CREATE POLICY "Autenticados podem atualizar" ON public.%I FOR UPDATE TO authenticated USING (true)', t
      );
      EXECUTE format(
        'CREATE POLICY "Autenticados podem excluir" ON public.%I FOR DELETE TO authenticated USING (true)', t
      );
    END IF;
  END LOOP;
END$$;

-- ─── 7. CAMPO cargo — DEFAULT 'Administrador' + TRIGGER ──────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text DEFAULT 'Administrador';

-- Atualizar registros existentes sem cargo
UPDATE public.profiles
  SET cargo = 'Administrador'
  WHERE cargo IS NULL OR cargo = '';

-- Trigger para novos usuários
CREATE OR REPLACE FUNCTION public.set_default_cargo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cargo IS NULL OR NEW.cargo = '' THEN
    NEW.cargo := 'Administrador';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_cargo ON public.profiles;
CREATE TRIGGER trigger_set_cargo
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_cargo();

-- ─── 8. TAMBÉM GARANTIR cargo NO TRIGGER handle_new_user ────────────────────
-- Recriar o trigger de criação de perfil incluindo cargo e role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin, role, cargo)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    true,
    'admin',
    'Administrador'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      role  = 'admin',
      cargo = COALESCE(EXCLUDED.cargo, 'Administrador');
  RETURN new;
END;
$$;

-- ─── 9. COLUNA last_seen PARA PRESENÇA ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- Inicializar last_seen para registros existentes que ainda não têm valor
UPDATE public.profiles
  SET last_seen = updated_at
  WHERE last_seen IS NULL;

-- ─── 10. ATIVAR REALTIME NA TABELA profiles ───────────────────────────────────
-- Bloco seguro: ignora erro se a publicação não existir
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'supabase_realtime: %', SQLERRM;
END$$;

-- ─── VERIFICAÇÃO FINAL ────────────────────────────────────────────────────────
-- Descomente para verificar o resultado após a execução:
-- SELECT id, email, full_name, role, cargo, last_seen FROM public.profiles;
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd;
