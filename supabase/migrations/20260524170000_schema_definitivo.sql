-- 1. EXTENSÕES E FUNÇÕES INICIAIS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. TABELA DE PERFIS DE USUÁRIOS
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  is_admin boolean DEFAULT false,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger de criação de perfil automática ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_admin)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TABELAS AUXILIARES E PARAMÉTRICAS
CREATE TABLE IF NOT EXISTS public.linhas_de_acao (
  id serial PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Popular Linhas de Ação da ONG
INSERT INTO public.linhas_de_acao (id, nome) VALUES
  (1, 'Convivência com o Semiárido'),
  (2, 'Saneamento Rural'),
  (3, 'Energias Renováveis'),
  (4, 'Agroecologia'),
  (5, 'Segurança Alimentar'),
  (6, 'Inclusão Socioprodutiva'),
  (7, 'Formação/ATER'),
  (8, 'Meio Ambiente'),
  (9, 'Comunicação Popular')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- Criar Tipo de Entrega da Tecnologia Social
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_entrega_enum') THEN
    CREATE TYPE tipo_entrega_enum AS ENUM ('Física', 'Metodológica');
  END IF;
END$$;

-- 4. TABELA DE TECNOLOGIAS SOCIAIS (Word Doc Expansion)
CREATE TABLE IF NOT EXISTS public.tecnologias_sociais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linha_de_acao_id int REFERENCES public.linhas_de_acao(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  tipo_entrega tipo_entrega_enum NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Popular tecnologias sociais iniciais (para servirem de base nos formulários)
INSERT INTO public.tecnologias_sociais (linha_de_acao_id, nome, tipo_entrega, descricao) VALUES
  (1, 'Cisternas de consumo humano', 'Física', 'Cisterna de placa com capacidade para 16 mil litros de água da chuva para beber e cozinhar.'),
  (1, 'Cisternas calçadão', 'Física', 'Cisterna com calçadão de captação de 52 mil litros para produção de alimentos e criação de animais.'),
  (1, 'Barreiro trincheira', 'Física', 'Estrutura escavada no solo profunda e estreita para reter água da chuva.'),
  (1, 'Barragens subterrâneas', 'Física', 'Muro impermeável subterrâneo construído transversalmente ao fluxo da água no aluvião.'),
  (1, 'Reuso de águas cinzas', 'Física', 'Sistema de filtragem e direcionamento de água cinza residencial para irrigação de pomares.'),
  (2, 'Banheiro redondo', 'Física', 'Solução ecológica e eficiente de saneamento básico rural descentralizado.'),
  (3, 'Sistemas fotovoltaicos para produção agrícola', 'Física', 'Placas solares conectadas para funcionamento de poços e bombas hidráulicas em plantios.'),
  (3, 'Biodigestores', 'Física', 'Geração de biogás residencial e biofertilizante a partir de dejetos animais.'),
  (4, 'Quintais produtivos agroecológicos', 'Física', 'Espaço de produção diversificada ao redor da residência com base agroecológica.'),
  (4, 'Sistemas agroflorestais (SAFs)', 'Física', 'Consórcio de culturas agrícolas com espécies arbóreas.'),
  (4, 'Bancos comunitários de sementes crioulas', 'Metodológica', 'Organização coletiva de guarda, seleção e preservação de sementes tradicionais.'),
  (5, 'Hortas comunitárias', 'Física', 'Plantio coletivo de hortaliças orgânicas em áreas comunitárias.'),
  (5, 'Beneficiamento de alimentos', 'Metodológica', 'Capacitação em processamento, higiene e conservação de frutas e hortaliças.'),
  (6, 'Feiras agroecológicas', 'Metodológica', 'Espaço de comercialização direta entre agricultores familiares e consumidores urbanos.'),
  (6, 'Apicultura sustentável', 'Física', 'Instalação de colmeias e kits de manejo seguro para produção de mel ecológico.'),
  (7, 'Diagnóstico Rural Participativo (DRP)', 'Metodológica', 'Metodologia de levantamento de necessidades e recursos comunitários junto às famílias.'),
  (7, 'Intercâmbios de experiências', 'Metodológica', 'Visitas técnicas de aprendizado e troca de saberes práticos entre agricultores e técnicos.'),
  (7, 'Dias de campo', 'Metodológica', 'Demonstrações práticas e visitas de campo focadas em uma tecnologia específica.'),
  (8, 'Recuperação de áreas degradadas', 'Física', 'Ações de terraceamento, plantio direto e revegetação da Caatinga.'),
  (8, 'Produção de mudas nativas', 'Física', 'Viveros comunitários organizados para a germinação e cuidado de espécies nativas do bioma.'),
  (9, 'Programas de rádio', 'Metodológica', 'Divulgação de práticas socioambientais, informativos e entrevistas na rádio local.'),
  (9, 'Produção de vídeos populares', 'Metodológica', 'Vídeos de curta duração gravados pela própria juventude rural relatando as tecnologias.')
ON CONFLICT DO NOTHING;

-- 5. TABELA DE PROJETOS (CONTRATOS)
CREATE TABLE IF NOT EXISTS public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contrato text NOT NULL UNIQUE,
  financiador text NOT NULL,
  inicio date NOT NULL,
  termino date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  municipios text[] NOT NULL DEFAULT '{}',
  publico_quant int NOT NULL DEFAULT 0,
  publico_caract text,
  status text NOT NULL CHECK (status IN ('Em execução', 'Concluído', 'Suspenso')) DEFAULT 'Em execução',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela pivot N:N para Tecnologias autorizadas em cada Projeto (com suporte a implementações do front-end)
CREATE TABLE IF NOT EXISTS public.projeto_tecnologias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  tecnologia_id uuid REFERENCES public.tecnologias_sociais(id) ON DELETE CASCADE,
  quantidade int NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'unidades',
  familias int,
  municipios text,
  comunidades text,
  data date,
  observacoes text
);

-- 6. TABELA DE BENEFICIÁRIOS (Evita contagem dupla, NIS/CPF flexível)
CREATE TABLE IF NOT EXISTS public.beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_identificador text UNIQUE NOT NULL, -- 11 dígitos, CPF ou NIS flexível
  nome_responsavel text NOT NULL,
  quantidade_familiares int NOT NULL DEFAULT 1,
  genero text NOT NULL CHECK (genero IN ('Masculino', 'Feminino', 'Outro')),
  faixa_etaria text NOT NULL CHECK (faixa_etaria IN ('Jovem', 'Adulto', 'Idoso')),
  quilombola boolean DEFAULT false,
  povo_originario boolean DEFAULT false,
  comunidade text,
  municipio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. TABELA DE ATIVIDADES
CREATE TABLE IF NOT EXISTS public.atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  local text,
  municipio text,
  responsaveis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pivot N:N Beneficiários participantes da atividade
CREATE TABLE IF NOT EXISTS public.atividade_beneficiarios (
  atividade_id uuid REFERENCES public.atividades(id) ON DELETE CASCADE,
  beneficiario_id uuid REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
  PRIMARY KEY (atividade_id, beneficiario_id)
);

-- Pivot N:N Tecnologias entregues/trabalhadas na atividade
CREATE TABLE IF NOT EXISTS public.atividade_tecnologias (
  atividade_id uuid REFERENCES public.atividades(id) ON DELETE CASCADE,
  tecnologia_id uuid REFERENCES public.tecnologias_sociais(id) ON DELETE CASCADE,
  PRIMARY KEY (atividade_id, tecnologia_id)
);

-- 8. TABELA DE ARQUIVOS E MÍDIAS (Storage Metadata)
CREATE TABLE IF NOT EXISTS public.arquivos_midia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  atividade_id uuid REFERENCES public.atividades(id) ON DELETE SET NULL,
  nome text NOT NULL,
  tipo_acao text,
  data date,
  local text,
  url text NOT NULL,
  tipo_arquivo text CHECK (tipo_arquivo IN ('imagem', 'documento')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9. TABELA DE AUDITORIA
CREATE TABLE IF NOT EXISTS public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  acao text NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  tabela text NOT NULL,
  registro_id text NOT NULL,
  detalhes jsonb,
  timestamp timestamptz NOT NULL DEFAULT now()
);

-- Trigger Function para registrar auditoria automaticamente
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_rec_id text;
  v_detalhes jsonb;
BEGIN
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_rec_id := OLD.id::text;
    v_detalhes := to_jsonb(OLD);
    INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, detalhes)
    VALUES (v_user_id, 'DELETE', TG_TABLE_NAME, v_rec_id, v_detalhes);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_rec_id := NEW.id::text;
    v_detalhes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, detalhes)
    VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME, v_rec_id, v_detalhes);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_rec_id := NEW.id::text;
    v_detalhes := to_jsonb(NEW);
    INSERT INTO public.auditoria (usuario_id, acao, tabela, registro_id, detalhes)
    VALUES (v_user_id, 'INSERT', TG_TABLE_NAME, v_rec_id, v_detalhes);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar gatilhos de auditoria
DROP TRIGGER IF EXISTS audit_projetos ON public.projetos;
CREATE TRIGGER audit_projetos
  AFTER INSERT OR UPDATE OR DELETE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_tecnologias_sociais ON public.tecnologias_sociais;
CREATE TRIGGER audit_tecnologias_sociais
  AFTER INSERT OR UPDATE OR DELETE ON public.tecnologias_sociais
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_beneficiarios ON public.beneficiarios;
CREATE TRIGGER audit_beneficiarios
  AFTER INSERT OR UPDATE OR DELETE ON public.beneficiarios
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_atividades ON public.atividades;
CREATE TRIGGER audit_atividades
  AFTER INSERT OR UPDATE OR DELETE ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_arquivos_midia ON public.arquivos_midia;
CREATE TRIGGER audit_arquivos_midia
  AFTER INSERT OR UPDATE OR DELETE ON public.arquivos_midia
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 10. SEGURANÇA E POLÍTICAS RLS (Row Level Security)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS em todas as tabelas
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

-- Configurar Políticas
-- 1. Profiles
DROP POLICY IF EXISTS "Leitura de perfis por autenticados" ON public.profiles;
CREATE POLICY "Leitura de perfis por autenticados" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Técnicos atualizam próprio perfil" ON public.profiles;
CREATE POLICY "Técnicos atualizam próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Técnicos inserem próprio perfil" ON public.profiles;
CREATE POLICY "Técnicos inserem próprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins excluem perfis" ON public.profiles;
CREATE POLICY "Admins excluem perfis" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

-- 2. Linhas de Ação (Apenas admins mudam parâmetros)
DROP POLICY IF EXISTS "Leitura de linhas de acao por autenticados" ON public.linhas_de_acao;
CREATE POLICY "Leitura de linhas de acao por autenticados" ON public.linhas_de_acao FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins criam linhas de acao" ON public.linhas_de_acao;
CREATE POLICY "Admins criam linhas de acao" ON public.linhas_de_acao FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins editam linhas de acao" ON public.linhas_de_acao;
CREATE POLICY "Admins editam linhas de acao" ON public.linhas_de_acao FOR UPDATE TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins deletam linhas de acao" ON public.linhas_de_acao;
CREATE POLICY "Admins deletam linhas de acao" ON public.linhas_de_acao FOR DELETE TO authenticated USING (public.is_admin());

-- 3. Tecnologias Sociais, Projetos, Beneficiários, Atividades, Arquivos Midia e Pivots
-- (Autenticados lêem/criam/editam; Admins deletam)
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
    EXECUTE format('DROP POLICY IF EXISTS "Leitura por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Insercao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Edicao por autenticados" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Exclusao apenas por admins" ON public.%I', t);

    EXECUTE format('CREATE POLICY "Leitura por autenticados" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Insercao por autenticados" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "Edicao por autenticados" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "Exclusao apenas por admins" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())', t);
  END LOOP;
END$$;

-- 11. CRIAÇÃO DOS USUÁRIOS SEED (Autenticação)
-- Limpar seeds anteriores se houver para evitar conflitos de chaves primárias
DELETE FROM auth.users WHERE id IN ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e');

-- Admin
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  '00000000-0000-0000-0000-000000000000',
  'admin@ongchapada.org.br',
  crypt('chapada2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Administrador Chapada","is_admin":true}',
  false,
  'authenticated',
  now(),
  now()
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  jsonb_build_object('sub', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'email', 'admin@ongchapada.org.br', 'email_verified', true),
  'email',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  now(),
  now(),
  now()
);

-- Técnico
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role, created_at, updated_at)
VALUES (
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  '00000000-0000-0000-0000-000000000000',
  'tecnico@ongchapada.org.br',
  crypt('chapada2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Técnico Chapada","is_admin":false}',
  false,
  'authenticated',
  now(),
  now()
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  jsonb_build_object('sub', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'email', 'tecnico@ongchapada.org.br', 'email_verified', true),
  'email',
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  now(),
  now(),
  now()
);

-- Garantir que perfis estejam preenchidos explicitamente em caso de falha de trigger de teste
INSERT INTO public.profiles (id, email, full_name, is_admin)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'admin@ongchapada.org.br', 'Administrador Chapada', true),
  ('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'tecnico@ongchapada.org.br', 'Técnico Chapada', false)
ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin, full_name = EXCLUDED.full_name;

-- 12. CONFIGURAÇÃO DO BUCKET DE ARMAZENAMENTO E SUAS POLÍTICAS
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens', 'imagens', true), ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao Storage
DROP POLICY IF EXISTS "Leitura publica de objetos" ON storage.objects;
CREATE POLICY "Leitura publica de objetos" ON storage.objects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Upload de objetos por autenticados (insert)" ON storage.objects;
CREATE POLICY "Upload de objetos por autenticados (insert)" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('imagens', 'documentos'));

DROP POLICY IF EXISTS "Upload de objetos por autenticados (update)" ON storage.objects;
CREATE POLICY "Upload de objetos por autenticados (update)" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('imagens', 'documentos'));

DROP POLICY IF EXISTS "Exclusao de objetos por admins" ON storage.objects;
CREATE POLICY "Exclusao de objetos por admins" ON storage.objects FOR DELETE TO authenticated USING (public.is_admin());
