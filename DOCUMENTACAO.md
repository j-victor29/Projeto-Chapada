# Documentação Técnica e do Banco de Dados - Sistema CHAPADA

Seja bem-vindo à documentação oficial do **Sistema CHAPADA** (Plataforma de Gestão de Projetos Sociais e Contratos da ONG CHAPADA). Esta documentação foi dividida em diretórios estruturados para facilitar o entendimento de desenvolvedores, administradores e operadores do sistema.

---

## 📂 Estrutura de Documentos Entregues

A documentação está dividida e organizada nos seguintes caminhos no repositório:

### 1. Manuais Técnicos e Guias (`/docs`)
* **[Visão Geral e Arquitetura](/docs/architecture.md):** Apresenta o propósito do sistema, o fluxo de dados em alto nível e os componentes da infraestrutura baseada em React e Supabase.
* **[Banco de Dados Postgres](/docs/db.md):** Contém a explicação lógica das tabelas, o código SQL dos Triggers (Auditoria, Criação de Perfis) e sugestões de otimização (índices adicionais).
* **[APIs e Integrações](/docs/api.md):** Descreve os conectores utilizados para integração assíncrona entre o front-end React e as tabelas e buckets de mídia do Supabase.
* **[Segurança e RLS](/docs/security.md):** Analisa o mecanismo de autenticação de sessão via tokens JWT, o controle de acesso Row Level Security (RLS) e destaca o alerta de vulnerabilidade na tabela `registro_colaboradores`.
* **[Operações e Infraestrutura](/docs/ops.md):** Detalha os ambientes de execução, o pipeline de deploy automático no Vercel, o checklist para onboarding de novos desenvolvedores e o plano de conformidade com a LGPD.

### 2. Artefatos Técnicos e Scripts (`/artifacts`)
* **[Dump Estrutural (schema.sql)](/artifacts/schema.sql):** O código DDL completo para recriar toda a estrutura física do banco de dados (tabelas, colunas, chaves estrangeiras, restrições e enums).
* **[Diagrama ER (erd.svg)](/artifacts/erd.svg):** O desenho vetorial em formato SVG ilustrando graficamente o relacionamento entre as principais entidades do sistema.
* **[Especificação da API (openapi.yaml)](/artifacts/openapi.yaml):** A especificação formal OpenAPI 3.0 descrevendo os endpoints de autenticação e manipulação das tabelas.
* **[Políticas de RLS (policies.sql)](/artifacts/policies.sql):** O dump contendo todas as políticas RLS aplicadas no banco de dados e nos buckets do storage.
* **[Manual de Backups (backups_instructions.md)](/artifacts/backups_instructions.md):** Instruções e comandos práticos para backup manual e restore das tabelas e do storage do Supabase.
* **[Guias de Resolução (runbooks.md)](/artifacts/runbooks.md):** Checklists rápidos de resposta a incidentes críticos, tais como downtime de serviço, vazamento de chaves ou rollbacks urgentes.
* **[Resumo Executivo (executive_summary.md)](/artifacts/executive_summary.md):** Uma página consolidada em markdown ideal para apresentação e alinhamento com stakeholders não técnicos.

---

## ⚡ Sumário do Sistema

| Item | Stack Tecnológica |
|---|---|
| **Front-End** | React 19, Vite 7, TanStack Router & Query, TailwindCSS 4, Sonner (Toast) |
| **Banco de Dados** | PostgreSQL 17 (Gerenciado pelo Supabase) |
| **Autenticação** | Supabase Auth (Sessões JWT persistidas no LocalStorage) |
| **Hospedagem** | Vercel (Front-end SPA) e Supabase (Banco de Dados, Realtime e Storage) |
| **Storage de Mídia** | Buckets no Supabase Storage (`imagens` e `documentos`) |
| **Realtime** | WebSocket via Supabase Presence (Monitoramento de status ativo dos colaboradores) |

---

## 🚀 Como Iniciar Localmente
1. Instale as dependências: `npm install` ou `bun install`.
2. Configure o arquivo `.env` local contendo as chaves de API públicas do Supabase.
3. Inicie o servidor Vite: `npm run dev`.
