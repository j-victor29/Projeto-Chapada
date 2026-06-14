-- ==============================================================
-- CÓDIGO E POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- SISTEMA GESTÃO DE PROJETOS - ONG CHAPADA
-- Provedor: Supabase / PostgreSQL 17
-- ==============================================================

-- 1. FUNÇÕES DE SUPORTE À SEGURANÇA E CONTRATAÇÕES

-- Função: is_admin()
-- Sempre retorna TRUE para qualquer usuário autenticado no sistema simplificado
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.uid() IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função: get_user_role()
-- Sempre retorna 'admin' para usuários autenticados no sistema simplificado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HABILITAÇÃO DO RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linhas_de_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnologias_sociais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tecnologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_beneficiarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_tecnologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos_midia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financiadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linhas_acao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_acao ENABLE ROW LEVEL SECURITY;

-- ATENÇÃO: A tabela public.registro_colaboradores NÃO tem RLS ativo!
-- ALTER TABLE public.registro_colaboradores ENABLE ROW LEVEL SECURITY; (DESATIVADO)

-- 3. POLÍTICAS DE RLS POR TABELA

-- Profiles
CREATE POLICY "Autenticados podem ler" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar" ON public.profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem excluir" ON public.profiles FOR DELETE TO authenticated USING (true);

-- Tabelas Principais (Qualquer autenticado possui acesso irrestrito de CRUD)
-- Projetos, Tecnologias Sociais, Beneficiários, Atividades, Pivots e Auditoria
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'tecnologias_sociais', 'projetos', 'projeto_tecnologias',
    'beneficiarios', 'atividades', 'atividade_beneficiarios',
    'atividade_tecnologias', 'arquivos_midia', 'auditoria',
    'linhas_de_acao', 'municipios', 'comunidades', 'financiadores',
    'categorias', 'publicos', 'projeto_municipios', 'locais', 'tipos_acao', 'linhas_acao', 'tecnologias'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "Autenticados podem ler" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Autenticados podem inserir" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Autenticados podem atualizar" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Autenticados podem excluir" ON public.%I FOR DELETE TO authenticated USING (true)', t);
  END LOOP;
END$$;

-- Documentos (Políticas Customizadas)
CREATE POLICY "Allow authenticated select on documentos" ON public.documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on documentos" ON public.documentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on documentos" ON public.documentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete on documentos" ON public.documentos FOR DELETE TO authenticated USING (true);

-- Notificações (Restrito ao Usuário Vinculado)
CREATE POLICY "Usuários leem suas notificacoes" ON public.notificacoes FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Usuários atualizam suas notificacoes" ON public.notificacoes FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
CREATE POLICY "Usuários deletam suas notificacoes" ON public.notificacoes FOR DELETE TO public USING (auth.uid() = usuario_id);
CREATE POLICY "Sistema insere notificacoes" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);

-- Favoritos do Usuário (Restrito ao Usuário Vinculado)
CREATE POLICY "Users can read own favoritos" ON public.user_favoritos FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favoritos" ON public.user_favoritos FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favoritos" ON public.user_favoritos FOR DELETE TO public USING (auth.uid() = user_id);

-- 4. POLÍTICAS DE ACESSO AO STORAGE (storage.objects)
-- buckets 'imagens' e 'documentos'

CREATE POLICY "Leitura publica de objetos" ON storage.objects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Upload de objetos por autenticados (insert)" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('imagens', 'documentos'));
CREATE POLICY "Upload de objetos por autenticados (update)" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('imagens', 'documentos'));
CREATE POLICY "Exclusao de objetos por admins" ON storage.objects FOR DELETE TO authenticated USING (public.is_admin());
