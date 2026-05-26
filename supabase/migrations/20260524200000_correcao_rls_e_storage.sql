-- ============================================================
-- MIGRATION DE CORREÇÃO: RLS, ROLES E STORAGE
-- Execute este script INTEIRO no SQL Editor do Supabase
-- ============================================================

-- ─── 1. CORRIGIR get_user_role() ─────────────────────────────────────────────
-- Problema: usuários existentes têm role=NULL → função retornava 'visualizador' → bloqueava INSERTs
-- Correção: default passa a ser 'editor' + captura qualquer exceção de coluna inexistente
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'editor'); -- 'editor' como fallback seguro
EXCEPTION WHEN OTHERS THEN
    RETURN 'editor'; -- Coluna pode não existir ainda: liberar acesso
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. GARANTIR COLUNA role NA TABELA profiles ───────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text
    CHECK (role IN ('admin', 'editor', 'visualizador'))
    DEFAULT 'editor';

-- ─── 3. MIGRAR USUÁRIOS EXISTENTES (NULL → roles corretas) ──────────────────
UPDATE public.profiles SET role = 'admin'  WHERE is_admin = true  AND role IS NULL;
UPDATE public.profiles SET role = 'editor' WHERE is_admin = false AND role IS NULL;
-- Definir default para novos registros
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'editor';

-- ─── 4. CORRIGIR is_admin() para usar a nova coluna role ────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin = true OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 5. RESTAURAR RLS ORIGINAL DAS TABELAS PRINCIPAIS ────────────────────────
-- Remove políticas restritivas que bloqueiam editores (se existirem)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tecnologias_sociais', 'projetos', 'projeto_tecnologias',
    'beneficiarios', 'atividades', 'atividade_beneficiarios',
    'atividade_tecnologias', 'arquivos_midia', 'auditoria'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Remove políticas antigas que usam get_user_role (muito restritivas)
    EXECUTE format('DROP POLICY IF EXISTS "Insercao por admin/editor" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Edicao por admin/editor" ON public.%I', t);
    -- Remove também as antigas permissivas (para recriar limpas)
    EXECUTE format('DROP POLICY IF EXISTS "Insercao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Edicao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins" ON public.%I', t);

    -- Recriar: qualquer autenticado pode INSERT/UPDATE; só admin pode DELETE
    EXECUTE format('CREATE POLICY "Insercao por autenticados" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Edicao por autenticados" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Exclusao apenas por admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t);
  END LOOP;
END$$;

-- ─── 6. RLS PARA NOVAS TABELAS MESTRAS (se já existirem) ─────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['municipios', 'comunidades', 'financiadores', 'categorias', 'publicos', 'projeto_municipios'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Insercao por admin/editor" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Edicao por admin/editor" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins" ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS "Leitura por autenticados" ON public.%I', t);

      EXECUTE format('CREATE POLICY "Leitura por autenticados" ON public.%I FOR SELECT TO authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "Insercao por autenticados" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
      EXECUTE format('CREATE POLICY "Edicao por autenticados" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
      EXECUTE format('CREATE POLICY "Exclusao apenas por admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t);
    END IF;
  END LOOP;
END$$;

-- ─── 7. BUCKET DOCUMENTOS E POLÍTICAS DE STORAGE ─────────────────────────────
-- Garantir que o bucket existe (privado é mais seguro para documentos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens', 'imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Remover TODAS as políticas existentes de storage.objects para recriar sem conflito
DROP POLICY IF EXISTS "Leitura publica de objetos" ON storage.objects;
DROP POLICY IF EXISTS "Upload de objetos por autenticados (insert)" ON storage.objects;
DROP POLICY IF EXISTS "Upload de objetos por autenticados (update)" ON storage.objects;
DROP POLICY IF EXISTS "Exclusao de objetos por admins" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Upload para Usuários Autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Leitura para Usuários Autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir Exclusão para Administradores e Criadores" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Leitura autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Upload autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Update autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Storage - Delete admin ou editor" ON storage.objects;

-- Recriar políticas limpas para todos os buckets do projeto
CREATE POLICY "storage_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('imagens', 'documentos'));

CREATE POLICY "storage_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('imagens', 'documentos'));

CREATE POLICY "storage_update_authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('imagens', 'documentos'));

CREATE POLICY "storage_delete_authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('imagens', 'documentos'));

-- ─── 8. ADICIONAR COLUNAS NOVAS EM arquivos_midia (SE NÃO EXISTIREM) ─────────
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS documento_pai_id uuid REFERENCES public.arquivos_midia(id) ON DELETE CASCADE;
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS versao int DEFAULT 1;
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
-- categoria como texto puro (sem FK para categorias por enquanto)
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS categoria text;
