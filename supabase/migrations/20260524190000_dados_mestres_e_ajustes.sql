-- 1. NOVAS TABELAS MESTRAS
CREATE TABLE IF NOT EXISTS public.municipios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    uf text NOT NULL DEFAULT 'BA',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comunidades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio_id uuid REFERENCES public.municipios(id) ON DELETE CASCADE,
    nome text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financiadores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    cnpj text,
    contato text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    tipo text NOT NULL CHECK (tipo IN ('documento', 'tecnologia', 'geral')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.publicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    descricao text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. AJUSTAR PROFILES (ROLES)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text CHECK (role IN ('admin', 'editor', 'visualizador'));

-- Migrar dados antigos: is_admin = true -> 'admin', is_admin = false -> 'editor'
UPDATE public.profiles SET role = 'admin' WHERE is_admin = true AND role IS NULL;
UPDATE public.profiles SET role = 'editor' WHERE is_admin = false AND role IS NULL;

-- Definir padrão e remover coluna is_admin obsoleta (opcional, vamos manter por compatibilidade por enquanto e focar na nova coluna)
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'visualizador';

-- 3. AJUSTAR PROJETOS
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS financiador_id uuid REFERENCES public.financiadores(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.projeto_municipios (
    projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
    municipio_id uuid REFERENCES public.municipios(id) ON DELETE CASCADE,
    PRIMARY KEY (projeto_id, municipio_id)
);

-- Tentar migrar dados textuais para tabelas mestras (Financiadores e Municípios)
DO $$
DECLARE
    r RECORD;
    v_fin_id uuid;
    v_mun_name text;
    v_mun_id uuid;
BEGIN
    FOR r IN SELECT id, financiador, municipios FROM public.projetos LOOP
        -- Financiadores
        IF r.financiador IS NOT NULL AND r.financiador != '' THEN
            INSERT INTO public.financiadores (nome) VALUES (r.financiador) ON CONFLICT (nome) DO NOTHING;
            SELECT id INTO v_fin_id FROM public.financiadores WHERE nome = r.financiador;
            UPDATE public.projetos SET financiador_id = v_fin_id WHERE id = r.id;
        END IF;

        -- Municipios
        IF array_length(r.municipios, 1) > 0 THEN
            FOREACH v_mun_name IN ARRAY r.municipios LOOP
                INSERT INTO public.municipios (nome) VALUES (v_mun_name) ON CONFLICT (nome) DO NOTHING;
                SELECT id INTO v_mun_id FROM public.municipios WHERE nome = v_mun_name;
                INSERT INTO public.projeto_municipios (projeto_id, municipio_id) VALUES (r.id, v_mun_id) ON CONFLICT DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- Agora podemos remover a coluna financiador antiga (opcional, vamos manter e apenas focar no ID no frontend)
-- ALTER TABLE public.projetos DROP COLUMN financiador;
-- ALTER TABLE public.projetos DROP COLUMN municipios;

-- 4. AJUSTAR BENEFICIÁRIOS E ATIVIDADES
ALTER TABLE public.beneficiarios ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL;
ALTER TABLE public.beneficiarios ADD COLUMN IF NOT EXISTS comunidade_id uuid REFERENCES public.comunidades(id) ON DELETE SET NULL;
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL;

-- 5. VERSIONAMENTO DE DOCUMENTOS (ARQUIVOS MIDIA)
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS documento_pai_id uuid REFERENCES public.arquivos_midia(id) ON DELETE CASCADE;
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS versao int DEFAULT 1;
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL;
ALTER TABLE public.arquivos_midia ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 6. SISTEMA DE NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    lida boolean NOT NULL DEFAULT false,
    link text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. REVISÃO DE RLS (Atualizando de is_admin() para checar 'role')
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'visualizador');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exemplo: habilitar RLS nas novas tabelas
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financiadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Aplicar permissões para Novas Tabelas (Leitura para todos, Escrita para Admin/Editor)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'municipios', 'comunidades', 'financiadores', 'categorias', 'publicos', 'projeto_municipios'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Leitura por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Insercao por admin/editor" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Edicao por admin/editor" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins" ON public.%I', t);

    EXECUTE format('CREATE POLICY "Leitura por autenticados" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Insercao por admin/editor" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN (''admin'', ''editor''))', t);
    EXECUTE format('CREATE POLICY "Edicao por admin/editor" ON public.%I FOR UPDATE TO authenticated USING (public.get_user_role() IN (''admin'', ''editor''))', t);
    EXECUTE format('CREATE POLICY "Exclusao apenas por admins" ON public.%I FOR DELETE TO authenticated USING (public.get_user_role() = ''admin'')', t);
  END LOOP;
END$$;

-- Ajustar RLS Notificações
DROP POLICY IF EXISTS "Usuários leem suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuários leem suas notificacoes" ON public.notificacoes FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "Usuários atualizam suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuários atualizam suas notificacoes" ON public.notificacoes FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "Sistema insere notificacoes" ON public.notificacoes;
CREATE POLICY "Sistema insere notificacoes" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true); -- Permitir inserção interna

-- Ajustar RLS de Tabelas antigas que antes eram (true) para insert/update (projetos, atividades, tecnologias...)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tecnologias_sociais', 'projetos', 
    'beneficiarios', 'atividades', 'atividade_beneficiarios', 
    'atividade_tecnologias', 'arquivos_midia'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Insercao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Edicao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins" ON public.%I', t);
    
    EXECUTE format('CREATE POLICY "Insercao por admin/editor" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.get_user_role() IN (''admin'', ''editor''))', t);
    EXECUTE format('CREATE POLICY "Edicao por admin/editor" ON public.%I FOR UPDATE TO authenticated USING (public.get_user_role() IN (''admin'', ''editor''))', t);
    EXECUTE format('CREATE POLICY "Exclusao apenas por admins" ON public.%I FOR DELETE TO authenticated USING (public.get_user_role() = ''admin'')', t);
  END LOOP;
END$$;

-- Opcional: Popular Dados de Categoria iniciais
INSERT INTO public.categorias (nome, tipo) VALUES
  ('Relatório', 'documento'),
  ('Apresentação', 'documento'),
  ('Planilha Orçamentária', 'documento'),
  ('Projeto Base', 'documento'),
  ('Manual', 'tecnologia'),
  ('Projeto Executivo', 'tecnologia')
ON CONFLICT (nome) DO NOTHING;
