# Banco de Dados (Supabase / PostgreSQL)

## 1. Descrição do Esquema Relacional
O banco de dados do Sistema CHAPADA baseia-se em tabelas estruturadas no Postgres 17 do Supabase. A modelagem garante a integridade referencial por meio de chaves estrangeiras com ações `ON DELETE CASCADE` ou `ON DELETE SET NULL` estrategicamente definidas.

### Principais Tabelas:
* **`profiles`:** Guarda as informações complementares dos usuários do Supabase Auth.
* **`projetos`:** Representa os contratos e orçamentos gerais.
* **`beneficiarios`:** Cadastro único de cidadãos atendidos, unificado por CPF ou NIS para evitar contagens redundantes.
* **`atividades`:** Registro de mutirões, capacitações e reuniões.
* **`tecnologias_sociais`:** Catálogo de tecnologias de convivência e capacitação.
* **`arquivos_midia` & `documentos`:** Metadados das imagens e relatórios armazenados fisicamente nos buckets.
* **`auditoria`:** Trilha de modificações (INSERT/UPDATE/DELETE) ativada por triggers.

---

## 2. Triggers e Funções de Banco de Dados

### handle_new_user()
Função disparada automaticamente após a criação de um usuário em `auth.users`, criando de imediato o perfil em `public.profiles`.
```sql
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
```

### process_audit_log()
Trigger genérico que intercepta alterações nas tabelas principais para arquivar o histórico detalhado na tabela `auditoria`.
```sql
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
```

---

## 3. Recomendações de Otimização e Índices Adicionais
Para acelerar filtros frequentes efetuados no front-end, sugere-se a criação dos seguintes índices no Postgres:
```sql
-- Índices para otimizar pesquisas de beneficiários por CPF e NIS
CREATE INDEX IF NOT EXISTS idx_beneficiarios_cpf ON public.beneficiarios(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_beneficiarios_nis ON public.beneficiarios(nis) WHERE nis IS NOT NULL;

-- Índices para buscas textuais (ILike) no nome do responsável do beneficiário
CREATE INDEX IF NOT EXISTS idx_beneficiarios_nome_trgm ON public.beneficiarios USING gin (nome_responsavel gin_trgm_ops);

-- Índice para carregamento ágil das auditorias por tabela ou timestamp
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_time ON public.auditoria(tabela, timestamp DESC);
```
