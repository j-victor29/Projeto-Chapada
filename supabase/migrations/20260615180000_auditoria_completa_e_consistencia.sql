-- 1. CONSTRAINTS DE UNICIDADE
-- Projetos: contrato único
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS uq_projetos_contrato;
ALTER TABLE public.projetos ADD CONSTRAINT uq_projetos_contrato UNIQUE (contrato);

-- Municípios: nome + UF únicos
ALTER TABLE public.municipios DROP CONSTRAINT IF EXISTS uq_municipios_nome_uf;
ALTER TABLE public.municipios DROP CONSTRAINT IF EXISTS municipios_nome_key;
ALTER TABLE public.municipios ADD CONSTRAINT uq_municipios_nome_uf UNIQUE (nome, uf);

-- Comunidades: nome único por município
ALTER TABLE public.comunidades DROP CONSTRAINT IF EXISTS uq_comunidades_nome_municipio;
ALTER TABLE public.comunidades ADD CONSTRAINT uq_comunidades_nome_municipio UNIQUE (nome, municipio_id);

-- Financiadores: nome único
ALTER TABLE public.financiadores DROP CONSTRAINT IF EXISTS uq_financiadores_nome;
ALTER TABLE public.financiadores DROP CONSTRAINT IF EXISTS financiadores_nome_key;
ALTER TABLE public.financiadores ADD CONSTRAINT uq_financiadores_nome UNIQUE (nome);

-- Colaboradores: sem duplicata de user por registro
ALTER TABLE public.registro_colaboradores DROP CONSTRAINT IF EXISTS uq_colaboradores_registro_user;
ALTER TABLE public.registro_colaboradores ADD CONSTRAINT uq_colaboradores_registro_user UNIQUE (tabela, registro_id, user_id);


-- 2. CONSTRAINTS DE VALIDAÇÃO (dados inválidos)
-- Datas: término não pode ser anterior ao início
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS chk_projetos_datas;
ALTER TABLE public.projetos ADD CONSTRAINT chk_projetos_datas CHECK (termino >= inicio);

-- Atividades: data até 1 ano no futuro
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS chk_atividades_data;
ALTER TABLE public.atividades ADD CONSTRAINT chk_atividades_data CHECK (data <= CURRENT_DATE + INTERVAL '1 year');

-- Valores numéricos não negativos
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS chk_projetos_valor;
ALTER TABLE public.projetos ADD CONSTRAINT chk_projetos_valor CHECK (valor >= 0);

-- Indicadores de beneficiários não negativos (como JSONB na tabela atividades)
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS chk_ativ_beneficiarios;
ALTER TABLE public.atividades ADD CONSTRAINT chk_ativ_beneficiarios CHECK (
  (COALESCE((indicadores->>'participantes')::int, 0) >= 0) AND
  (COALESCE((indicadores->>'mulheres')::int, 0) >= 0) AND
  (COALESCE((indicadores->>'jovens')::int, 0) >= 0) AND
  (COALESCE((indicadores->>'quilombolas')::int, 0) >= 0) AND
  (COALESCE((indicadores->>'povosOriginarios')::int, 0) >= 0) AND
  (COALESCE((indicadores->>'comunidadesTradicionais')::int, 0) >= 0)
);

-- Mulheres e jovens não podem ser maiores que participantes totais
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS chk_ativ_subgrupos;
ALTER TABLE public.atividades ADD CONSTRAINT chk_ativ_subgrupos CHECK (
  COALESCE((indicadores->>'mulheres')::int, 0) <= COALESCE((indicadores->>'participantes')::int, 0) AND
  COALESCE((indicadores->>'jovens')::int, 0) <= COALESCE((indicadores->>'participantes')::int, 0)
);


-- 3. NOT NULL em campos obrigatórios (sem atividades.projeto_id e comunidades.municipio_id)
ALTER TABLE public.projetos ALTER COLUMN nome SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN contrato SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN financiador_id SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN inicio SET NOT NULL;
ALTER TABLE public.projetos ALTER COLUMN termino SET NOT NULL;

ALTER TABLE public.atividades ALTER COLUMN data SET NOT NULL;
ALTER TABLE public.atividades ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.municipios ALTER COLUMN nome SET NOT NULL;
ALTER TABLE public.municipios ALTER COLUMN uf SET NOT NULL;

ALTER TABLE public.comunidades ALTER COLUMN nome SET NOT NULL;

ALTER TABLE public.financiadores ALTER COLUMN nome SET NOT NULL;

ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;


-- 4. PADRONIZAÇÃO via Triggers no banco
-- Trigger de padronização de texto (trim + title case)
CREATE OR REPLACE FUNCTION public.fn_padronizar_texto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nome IS NOT NULL THEN
    NEW.nome := INITCAP(TRIM(REGEXP_REPLACE(NEW.nome, '\s+', ' ', 'g')));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em municipios, comunidades, financiadores
DROP TRIGGER IF EXISTS trg_municipios_nome ON public.municipios;
CREATE TRIGGER trg_municipios_nome
BEFORE INSERT OR UPDATE ON public.municipios
FOR EACH ROW EXECUTE FUNCTION public.fn_padronizar_texto();

DROP TRIGGER IF EXISTS trg_comunidades_nome ON public.comunidades;
CREATE TRIGGER trg_comunidades_nome
BEFORE INSERT OR UPDATE ON public.comunidades
FOR EACH ROW EXECUTE FUNCTION public.fn_padronizar_texto();

DROP TRIGGER IF EXISTS trg_financiadores_nome ON public.financiadores;
CREATE TRIGGER trg_financiadores_nome
BEFORE INSERT OR UPDATE ON public.financiadores
FOR EACH ROW EXECUTE FUNCTION public.fn_padronizar_texto();

-- Trigger de contrato em maiúsculas
CREATE OR REPLACE FUNCTION public.fn_padronizar_contrato()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contrato IS NOT NULL THEN
    NEW.contrato := UPPER(TRIM(NEW.contrato));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projetos_contrato ON public.projetos;
CREATE TRIGGER trg_projetos_contrato
BEFORE INSERT OR UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.fn_padronizar_contrato();

-- Trigger de e-mail em minúsculas
CREATE OR REPLACE FUNCTION public.fn_padronizar_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_email ON public.profiles;
CREATE TRIGGER trg_profiles_email
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_padronizar_email();


-- 5. ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_atividades_projeto ON public.atividades(projeto_id);
CREATE INDEX IF NOT EXISTS idx_atividades_data ON public.atividades(data DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_created_by ON public.documentos(created_by);
CREATE INDEX IF NOT EXISTS idx_colaboradores_registro ON public.registro_colaboradores(tabela, registro_id);


-- 6. AJUSTAR FOREIGN KEYS E AÇÕES ON DELETE/UPDATE
-- projetos -> financiadores: ON DELETE RESTRICT
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS projetos_financiador_id_fkey;
ALTER TABLE public.projetos ADD CONSTRAINT projetos_financiador_id_fkey 
  FOREIGN KEY (financiador_id) REFERENCES public.financiadores(id) ON DELETE RESTRICT;

-- atividades -> projetos: ON DELETE CASCADE
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS atividades_projeto_id_fkey;
ALTER TABLE public.atividades ADD CONSTRAINT atividades_projeto_id_fkey 
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE CASCADE;

-- atividades -> municipios: ON DELETE SET NULL
ALTER TABLE public.atividades DROP CONSTRAINT IF EXISTS atividades_municipio_id_fkey;
ALTER TABLE public.atividades ADD CONSTRAINT atividades_municipio_id_fkey 
  FOREIGN KEY (municipio_id) REFERENCES public.municipios(id) ON DELETE SET NULL;

-- documentos -> projetos: ON DELETE SET NULL (documentos possuem projeto_id)
ALTER TABLE public.documentos DROP CONSTRAINT IF EXISTS documentos_projeto_id_fkey;
ALTER TABLE public.documentos ADD CONSTRAINT documentos_projeto_id_fkey 
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE SET NULL;

-- arquivos_midia -> projetos: ON DELETE SET NULL
ALTER TABLE public.arquivos_midia DROP CONSTRAINT IF EXISTS arquivos_midia_projeto_id_fkey;
ALTER TABLE public.arquivos_midia ADD CONSTRAINT arquivos_midia_projeto_id_fkey 
  FOREIGN KEY (projeto_id) REFERENCES public.projetos(id) ON DELETE SET NULL;

-- arquivos_midia -> atividades: ON DELETE CASCADE
ALTER TABLE public.arquivos_midia DROP CONSTRAINT IF EXISTS arquivos_midia_atividade_id_fkey;
ALTER TABLE public.arquivos_midia ADD CONSTRAINT arquivos_midia_atividade_id_fkey 
  FOREIGN KEY (atividade_id) REFERENCES public.atividades(id) ON DELETE CASCADE;

-- registro_colaboradores -> auth.users: ON DELETE CASCADE
ALTER TABLE public.registro_colaboradores DROP CONSTRAINT IF EXISTS registro_colaboradores_user_id_fkey;
ALTER TABLE public.registro_colaboradores ADD CONSTRAINT registro_colaboradores_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- 7. ATUALIZAÇÃO AUTOMÁTICA DE STATUS DE PROJETOS
CREATE OR REPLACE FUNCTION public.fn_atualizar_status_projeto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.termino < CURRENT_DATE AND NEW.status = 'Em execução' THEN
    NEW.status := 'Concluído';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_status_projeto ON public.projetos;
CREATE TRIGGER trg_atualizar_status_projeto
BEFORE INSERT OR UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.fn_atualizar_status_projeto();
