-- ==========================================
-- DUMP COMPLETO DO ESQUEMA DE BANCO DE DADOS
-- SISTEMA GESTÃO DE PROJETOS - ONG CHAPADA
-- Provedor: Supabase / PostgreSQL 17
-- Gerado em: 14/06/2026
-- ==========================================

-- Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE tipo_entrega_enum AS ENUM ('Física', 'Metodológica');

-- 1. TABELA DE PERFIS DE USUÁRIOS
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    is_admin boolean DEFAULT false,
    photo_url text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    role text DEFAULT 'admin'::text,
    cargo text DEFAULT 'Administrador'::text,
    last_seen timestamp with time zone DEFAULT now()
);

-- 2. TABELA DE LINHAS DE AÇÃO
CREATE TABLE public.linhas_de_acao (
    id serial PRIMARY KEY,
    nome text NOT NULL UNIQUE,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela Legada / Adicional de Linhas de Ação (linhas_acao)
CREATE TABLE public.linhas_acao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    ativo boolean DEFAULT true
);

-- 3. TABELA DE TECNOLOGIAS SOCIAIS (Catálogo / Word Doc Expansion)
CREATE TABLE public.tecnologias_sociais (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    linha_de_acao_id integer REFERENCES public.linhas_de_acao(id) ON DELETE RESTRICT,
    nome text NOT NULL,
    tipo_entrega public.tipo_entrega_enum NOT NULL,
    descricao text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid
);

-- Catálogo Adicional / Legado de Tecnologias (tecnologias)
CREATE TABLE public.tecnologias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    linha_acao text NOT NULL,
    ativo boolean DEFAULT true
);

-- 4. TABELA DE FINANCIADORES
CREATE TABLE public.financiadores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    cnpj text,
    contato text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    tipo text,
    site text
);

-- 5. TABELA DE PROJETOS (Contratos)
CREATE TABLE public.projetos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    contrato text NOT NULL UNIQUE,
    financiador text NOT NULL,
    inicio date NOT NULL,
    termino date NOT NULL,
    valor numeric NOT NULL DEFAULT 0,
    municipios text[] NOT NULL DEFAULT '{}'::text[],
    publico_quant integer NOT NULL DEFAULT 0,
    publico_caract text,
    status text NOT NULL DEFAULT 'Em execução'::text CHECK (status IN ('Em execução', 'Concluído', 'Suspenso')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    financiador_id uuid REFERENCES public.financiadores(id) ON DELETE SET NULL,
    comunidades_atendidas text[] NOT NULL DEFAULT '{}'::text[],
    created_by uuid
);

-- 6. TABELA PIVOT: PROJETO_TECNOLOGIAS (Tecnologias Autorizadas por Projeto)
CREATE TABLE public.projeto_tecnologias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    tecnologia_id uuid NOT NULL REFERENCES public.tecnologias(id) ON DELETE CASCADE,
    quantidade integer NOT NULL DEFAULT 1,
    unidade text NOT NULL DEFAULT 'unidades'::text,
    familias integer,
    municipios text,
    comunidades text,
    data date,
    observacoes text,
    created_by uuid
);

-- 7. TABELA DE MUNICIPIOS
CREATE TABLE public.municipios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    uf text NOT NULL DEFAULT 'BA'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    regiao text,
    codigo_ibge text,
    estado text,
    microrregiao text
);

-- 8. TABELA DE COMUNIDADES
CREATE TABLE public.comunidades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL,
    nome text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    tipo text,
    criado_via text,
    categoria text NOT NULL DEFAULT 'Comunidade'::text
);

-- 9. TABELA PIVOT: PROJETO_MUNICIPIOS
CREATE TABLE public.projeto_municipios (
    projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
    PRIMARY KEY (projeto_id, municipio_id)
);

-- 10. TABELA DE BENEFICIÁRIOS (Evita contagem dupla)
CREATE TABLE public.beneficiarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_identificador text UNIQUE,
    nome_responsavel text NOT NULL,
    quantidade_familiares integer NOT NULL DEFAULT 1,
    genero text CHECK (genero IN ('Masculino', 'Feminino', 'Outro')),
    faixa_etaria text CHECK (faixa_etaria IN ('Jovem', 'Adulto', 'Idoso')),
    quilombola boolean DEFAULT false,
    povo_originario boolean DEFAULT false,
    comunidade text,
    municipio text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL,
    comunidade_id uuid REFERENCES public.comunidades(id) ON DELETE SET NULL,
    cpf text UNIQUE,
    nis text UNIQUE
);

-- 11. TABELA DE ATIVIDADES
CREATE TABLE public.atividades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
    data date NOT NULL,
    tipo text NOT NULL,
    descricao text NOT NULL,
    local text,
    municipio text,
    responsaveis text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    municipio_id uuid REFERENCES public.municipios(id) ON DELETE SET NULL,
    indicadores jsonb,
    anexos jsonb,
    titulo text,
    created_by uuid
);

-- 12. TABELAS PIVOT PARA ATIVIDADES (Participação e Entregas)
CREATE TABLE public.atividade_beneficiarios (
    atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
    beneficiario_id uuid NOT NULL REFERENCES public.beneficiarios(id) ON DELETE CASCADE,
    PRIMARY KEY (atividade_id, beneficiario_id)
);

CREATE TABLE public.atividade_tecnologias (
    atividade_id uuid NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
    tecnologia_id uuid NOT NULL REFERENCES public.tecnologias_sociais(id) ON DELETE CASCADE,
    PRIMARY KEY (atividade_id, tecnologia_id)
);

-- 13. TABELA DE CATEGORIAS
CREATE TABLE public.categorias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    cor text DEFAULT '#1A9FD4'::text,
    icone text
);

-- 14. TABELA DE PUBLICOS (Público-alvo parametrizado)
CREATE TABLE public.publicos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 15. TABELA DE ARQUIVOS E MÍDIAS (Storage Metadata)
CREATE TABLE public.arquivos_midia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
    atividade_id uuid REFERENCES public.atividades(id) ON DELETE SET NULL,
    nome text NOT NULL,
    tipo_acao text,
    data date,
    local text,
    url text NOT NULL,
    tipo_arquivo text CHECK (tipo_arquivo IN ('imagem', 'documento')),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    documento_pai_id uuid REFERENCES public.arquivos_midia(id) ON DELETE SET NULL,
    versao integer DEFAULT 1,
    categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
    tags text[] DEFAULT '{}'::text[]
);

-- 16. TABELA DE DOCUMENTOS
CREATE TABLE public.documentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text NOT NULL,
    descricao text,
    categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
    projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
    storage_path text,
    mime_type text,
    tamanho bigint,
    versao integer NOT NULL DEFAULT 1,
    documento_pai_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
    tags text[] DEFAULT '{}'::text[],
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 17. TABELA DE REGISTRO DE COLABORADORES (Segurança de Edição de Registros - SEM RLS!)
-- NOTA: RLS desabilitado nesta tabela, permitindo acesso total via chaves anon/authenticated.
CREATE TABLE public.registro_colaboradores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela text NOT NULL,
    registro_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    permitir_todos boolean DEFAULT false,
    criado_em timestamp with time zone DEFAULT now()
);

-- 18. TABELA DE AUDITORIA
CREATE TABLE public.auditoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    acao text NOT NULL,
    tabela text NOT NULL,
    registro_id text NOT NULL,
    detalhes jsonb,
    timestamp timestamp with time zone NOT NULL DEFAULT now()
);

-- 19. TABELA DE NOTIFICAÇÕES
CREATE TABLE public.notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    lida boolean NOT NULL DEFAULT false,
    link text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    tipo text,
    remetente text,
    remetente_id uuid
);

-- 20. TABELA DE LOCAIS
CREATE TABLE public.locais (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text,
    criado_via text,
    data_criacao timestamp with time zone DEFAULT now()
);

-- 21. TABELA DE TIPOS DE AÇÃO
CREATE TABLE public.tipos_acao (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    padrao boolean DEFAULT false,
    criado_via text,
    data_criacao timestamp with time zone DEFAULT now()
);

-- 22. TABELA DE FAVORITOS DO USUÁRIO
CREATE TABLE public.user_favoritos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tipo text NOT NULL,
    item_nome text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
