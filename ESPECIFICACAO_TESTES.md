# 📋 Especificação de Testes — Sistema CHAPADA

> **Projeto:** Sistema de Gestão de Projetos — CHAPADA  
> **Versão:** 1.0  
> **Data:** 05/06/2026  
> **Responsável:** Equipe de Desenvolvimento CHAPADA  
> **Stack:** React 19 · TypeScript · Vite 7 · TanStack Router · TanStack Query · Supabase (Auth + PostgreSQL + Storage + Realtime) · TailwindCSS 4 · Radix UI / shadcn-ui · Zod · React Hook Form · Recharts · jsPDF

---

## Sumário

1. [Objetivo](#1-objetivo)
2. [Escopo dos Testes](#2-escopo-dos-testes)
3. [Estratégia de Testes](#3-estratégia-de-testes)
4. [Ambientes de Teste](#4-ambientes-de-teste)
5. [Ferramentas Recomendadas](#5-ferramentas-recomendadas)
6. [Testes de Front-End](#6-testes-de-front-end)
   - 6.1 [Testes Unitários](#61-testes-unitários)
   - 6.2 [Testes de Componentes](#62-testes-de-componentes)
   - 6.3 [Testes de Integração (Front-End)](#63-testes-de-integração-front-end)
   - 6.4 [Testes End-to-End (E2E)](#64-testes-end-to-end-e2e)
   - 6.5 [Testes de Acessibilidade](#65-testes-de-acessibilidade)
   - 6.6 [Testes Visuais / Responsividade](#66-testes-visuais--responsividade)
7. [Testes de Back-End (Supabase)](#7-testes-de-back-end-supabase)
   - 7.1 [Testes de Banco de Dados (Schema)](#71-testes-de-banco-de-dados-schema)
   - 7.2 [Testes de Row Level Security (RLS)](#72-testes-de-row-level-security-rls)
   - 7.3 [Testes de Autenticação](#73-testes-de-autenticação)
   - 7.4 [Testes de Storage (Buckets)](#74-testes-de-storage-buckets)
   - 7.5 [Testes de Triggers e Auditoria](#75-testes-de-triggers-e-auditoria)
   - 7.6 [Testes de Realtime / Presence](#76-testes-de-realtime--presence)
8. [Cenários de Teste Detalhados](#8-cenários-de-teste-detalhados)
   - 8.1 [Módulo de Autenticação](#81-módulo-de-autenticação)
   - 8.2 [Dashboard](#82-dashboard)
   - 8.3 [Projetos](#83-projetos)
   - 8.4 [Atividades](#84-atividades)
   - 8.5 [Ações Independentes](#85-ações-independentes)
   - 8.6 [Tecnologias Sociais](#86-tecnologias-sociais)
   - 8.7 [Cadastros (Beneficiários)](#87-cadastros-beneficiários)
   - 8.8 [Banco de Imagens](#88-banco-de-imagens)
   - 8.9 [Documentos](#89-documentos)
   - 8.10 [Indicadores](#810-indicadores)
   - 8.11 [Usuários (Admin)](#811-usuários-admin)
   - 8.12 [Auditoria](#812-auditoria)
9. [Critérios de Aceite Globais](#9-critérios-de-aceite-globais)
10. [Plano de Regressão](#10-plano-de-regressão)
11. [Métricas de Qualidade](#11-métricas-de-qualidade)

---

## 1. Objetivo

Este documento estabelece a especificação completa dos testes para o sistema **CHAPADA** — plataforma de gestão de projetos e programas sociais do Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe. O objetivo é garantir a **confiabilidade**, **segurança** e **usabilidade** do sistema em todas as suas camadas: front-end (interface React) e back-end (Supabase PostgreSQL, autenticação, storage e realtime).

---

## 2. Escopo dos Testes

### ✅ Dentro do Escopo

| Camada | Componentes |
|--------|-------------|
| **Front-End** | Todas as 15 rotas/páginas, 9 componentes customizados, 48 componentes UI (shadcn), 5 hooks, 2 contexts, 12+ stores/lib |
| **Back-End** | 11 tabelas PostgreSQL, 3 tabelas pivot, RLS em 11 tabelas, triggers de auditoria em 5 tabelas, 2 buckets de storage, funções SQL (`is_admin`, `handle_new_user`, `process_audit_log`), Realtime Presence |
| **Autenticação** | Login, Registro, Esqueci Senha, Criar Senha, sessões, roles (admin/técnico) |
| **Integração** | Comunicação React ↔ Supabase Client ↔ Supabase API |

### ❌ Fora do Escopo

- Testes de infraestrutura do Supabase (uptime, CDN)
- Testes de performance/carga (podem ser adicionados posteriormente)
- Testes de penetração avançados (recomendado contratar externamente)

---

## 3. Estratégia de Testes

Adotamos a **Pirâmide de Testes** adaptada ao contexto SPA + BaaS:

```
         ╱╲
        ╱ E2E ╲          ← Poucos testes, alto custo, fluxos críticos
       ╱────────╲
      ╱ Integração╲      ← Testes de fluxo React ↔ Supabase
     ╱──────────────╲
    ╱  Componentes    ╲   ← Renderização, interação, estados
   ╱────────────────────╲
  ╱   Unitários / SQL     ╲ ← Funções puras, utils, validações, RLS
 ╱──────────────────────────╲
```

---

## 4. Ambientes de Teste

| Ambiente | Descrição | Banco de Dados |
|----------|-----------|----------------|
| **Local (Dev)** | `npm run dev` (Vite) + Supabase local via CLI | Banco local com seeds |
| **Staging** | Deploy Vercel Preview + Supabase branch/staging | Branch database |
| **Produção** | `vaibjtbayfpmvxxbtuxi.supabase.co` | ⚠️ Somente testes de fumaça |

### Usuários de Teste (Seed)

| Perfil | E-mail | Senha | Role |
|--------|--------|-------|------|
| **Administrador** | `admin@ongchapada.org.br` | `chapada2026` | `admin` (`is_admin: true`) |
| **Técnico / Colaborador** | `tecnico@ongchapada.org.br` | `chapada2026` | `admin` (`is_admin: true`) |

---

## 5. Ferramentas Recomendadas

| Categoria | Ferramenta | Propósito |
|-----------|-----------|-----------|
| **Testes Unitários** | Vitest | Testes de funções, utils, hooks isolados |
| **Testes de Componentes** | Vitest + React Testing Library | Renderização e interação de componentes |
| **Testes E2E** | Playwright | Fluxos completos no navegador |
| **Testes de BD/RLS** | pgTAP ou SQL direto no Supabase | Políticas RLS, triggers, constraints |
| **Cobertura** | Vitest (c8/istanbul) | Relatórios de cobertura de código |
| **Acessibilidade** | axe-core + Playwright | Conformidade WCAG |
| **Visual** | Playwright Screenshots | Regressão visual entre deploys |

---

## 6. Testes de Front-End

### 6.1 Testes Unitários

Testes de funções puras e utilitários sem dependências de DOM ou rede.

#### 📁 `src/lib/utils.ts`

| ID | Cenário | Entrada | Saída Esperada |
|----|---------|---------|----------------|
| UT-001 | `cn()` combina classes corretamente | `cn("px-2", "py-1")` | `"px-2 py-1"` |
| UT-002 | `cn()` resolve conflitos Tailwind | `cn("px-2", "px-4")` | `"px-4"` |
| UT-003 | `cn()` ignora valores falsy | `cn("px-2", false, undefined, "py-1")` | `"px-2 py-1"` |

#### 📁 `src/lib/progress.ts`

| ID | Cenário | Entrada | Saída Esperada |
|----|---------|---------|----------------|
| UT-004 | Cálculo de progresso retorna 0 para vazio | `(0, 0)` | `0` |
| UT-005 | Cálculo de progresso retorna porcentagem correta | `(50, 100)` | `50` |
| UT-006 | Progresso nunca excede 100% | `(150, 100)` | `100` |

#### 📁 `src/hooks/use-debounce.ts`

| ID | Cenário | Entrada | Saída Esperada |
|----|---------|---------|----------------|
| UT-007 | Debounce retarda atualização | Valor muda rapidamente 3× em 200ms | Apenas o último valor é emitido após delay |
| UT-008 | Debounce emite imediatamente se delay=0 | `useDebounce("test", 0)` | Valor imediato |

#### 📁 `src/hooks/use-mobile.tsx`

| ID | Cenário | Entrada | Saída Esperada |
|----|---------|---------|----------------|
| UT-009 | Detecta viewport mobile | `window.innerWidth = 360` | `true` |
| UT-010 | Detecta viewport desktop | `window.innerWidth = 1440` | `false` |

#### 📁 Validações Zod (em rotas)

| ID | Cenário | Entrada | Saída Esperada |
|----|---------|---------|----------------|
| UT-011 | Search schema do login aceita `msg=registered` | `{ msg: "registered" }` | ✅ Valid |
| UT-012 | Search schema do login rejeita valor inválido | `{ msg: "invalid" }` | ❌ ZodError |
| UT-013 | Search schema do login aceita ausência de msg | `{}` | ✅ Valid (`msg: undefined`) |

---

### 6.2 Testes de Componentes

Testes de renderização, interação e estado visual dos componentes.

#### 📁 `src/components/ThemeToggle.tsx`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| CT-001 | Renderiza botão de tema | Mount | Ícone de sol ou lua visível |
| CT-002 | Alterna para dark mode | Click no toggle | Classe `dark` adicionada ao `<html>` |
| CT-003 | Persiste tema no localStorage | Toggle → Reload | Tema mantido |

#### 📁 `src/components/AppSidebar.tsx`

| ID | Cenário | Condição | Resultado Esperado |
|----|---------|----------|--------------------|
| CT-004 | Renderiza todos os itens de menu | Qualquer usuário logado | Todos os 10 itens visíveis (inclui Usuários) |
| CT-005 | Auditoria nunca aparece no menu | Qualquer usuário logado | Item "Auditoria" ausente |
| CT-007 | Item ativo recebe destaque visual | URL = `/projetos` | Item "Projetos" com classe `bg-sidebar-primary` |
| CT-008 | Logo CHAPADA renderiza corretamente | Mount | Imagem `chapada-logo.png` presente |

#### 📁 `src/components/AppLayout.tsx`

| ID | Cenário | Condição | Resultado Esperado |
|----|---------|----------|--------------------|
| CT-009 | Redireciona para login se não autenticado | `session=null` | Navegação para `/login` |
| CT-010 | Renderiza sidebar + conteúdo se autenticado | `session=valid` | Sidebar + `<Outlet>` visíveis |
| CT-011 | Exibe modal de perfil ao clicar no avatar | Click no avatar | `ProfileModal` aberto |

#### 📁 `src/components/AuthLayout.tsx`

| ID | Cenário | Condição | Resultado Esperado |
|----|---------|----------|--------------------|
| CT-012 | Renderiza layout split (esquerda/direita) | Mount | Dois painéis visíveis |
| CT-013 | Responsivo: mostra apenas formulário em mobile | `viewport < 768px` | Apenas painel direito (formulário) |

#### 📁 `src/components/ProfileModal.tsx`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| CT-014 | Exibe dados do perfil logado | Open | Nome, e-mail, cargo visíveis |
| CT-015 | Permite editar nome completo | Altera input + salva | Nome atualizado no banco |
| CT-016 | Upload de foto de perfil | Seleciona arquivo | Preview exibido, URL salva |

#### 📁 `src/components/CollaboratorsSection.tsx`

| ID | Cenário | Condição | Resultado Esperado |
|----|---------|----------|--------------------|
| CT-017 | Lista usuários online | 2 usuários online | 2 avatares com badge verde |
| CT-018 | Mostra status inativo | Usuário idle > 5min | Badge amarelo/cinza |

#### 📁 `src/components/LocalComunidadeSelect.tsx`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| CT-019 | Carrega municípios do banco | Mount | Dropdown com opções preenchidas |
| CT-020 | Filtra comunidades por município selecionado | Seleciona município | Comunidades filtradas |

#### 📁 `src/components/TipoAcaoSelect.tsx`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| CT-021 | Carrega tipos de ação | Mount | Dropdown com opções |
| CT-022 | Emite valor selecionado | Seleciona item | `onChange` chamado com valor correto |

---

### 6.3 Testes de Integração (Front-End)

Testes que validam a comunicação entre componentes React e os stores/hooks que interagem com o Supabase.

#### 📁 `src/lib/projetosStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-001 | Busca lista de projetos | Chamada de query | Array de projetos retornado |
| IT-002 | Cria novo projeto | Mutation com dados válidos | Projeto inserido, cache invalidado |
| IT-003 | Atualiza projeto existente | Mutation de update | Dados atualizados, toast de sucesso |
| IT-004 | Exclui projeto (admin) | Mutation de delete | Projeto removido do banco |
| IT-005 | Exclui projeto por qualquer usuário | Mutation de delete | Projeto removido do banco, RLS permite para todos |

#### 📁 `src/lib/atividadesStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-006 | Busca atividades por projeto | Query com `projeto_id` | Atividades filtradas |
| IT-007 | Cria atividade com beneficiários vinculados | Mutation com pivot | Registros em `atividades` + `atividade_beneficiarios` |
| IT-008 | Cria atividade com tecnologias vinculadas | Mutation com pivot | Registros em `atividades` + `atividade_tecnologias` |

#### 📁 `src/lib/cadastrosStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-009 | Cadastra beneficiário com CPF/NIS | Mutation | Registro criado em `beneficiarios` |
| IT-010 | Rejeita CPF/NIS duplicado | Mutation com documento existente | Erro unique constraint |
| IT-011 | Valida campos obrigatórios (nome, gênero, faixa etária) | Mutation sem campos | Erro de validação Zod |

#### 📁 `src/lib/tecnologiasStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-012 | Lista tecnologias com linhas de ação | Query com join | Tecnologias com campo `linha_de_acao` preenchido |
| IT-013 | Cria tecnologia social | Mutation | Registro criado com `tipo_entrega` válido |

#### 📁 `src/lib/imagensStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-014 | Upload de imagem para bucket | Upload file | Arquivo salvo em `storage/imagens/` |
| IT-015 | Registra metadados da imagem | Insert em `arquivos_midia` | Registro com URL pública do arquivo |
| IT-016 | Filtra imagens por projeto | Query com filtro | Apenas imagens do projeto retornadas |

#### 📁 `src/lib/documentosStore.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-017 | Upload de documento PDF | Upload file | Arquivo salvo em `storage/documentos/` |
| IT-018 | Lista documentos com metadados | Query | Documentos com nome, data, URL |

#### 📁 `src/contexts/AuthContext.tsx`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-019 | Sessão carregada ao montar | `getSession()` | Estado `session` preenchido |
| IT-020 | Listener `onAuthStateChange` atualiza estado | Login/Logout | Estado `session` reflete mudança |
| IT-021 | `signOut()` limpa sessão | Chamada de signOut | `session=null`, `user=null` |

#### 📁 `src/hooks/useUserPresence.ts`

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| IT-022 | Inscreve no canal Presence | Mount com user autenticado | Canal `chapada-user-presence` ativo |
| IT-023 | Track de status online | Subscribe + track | Usuário aparece como `online` |
| IT-024 | Transição para inactive após 5 min | Sem interação por 5 min | Status muda para `inactive` |
| IT-025 | Heartbeat atualiza `last_seen` | Após 2 min | Campo `last_seen` atualizado no banco |
| IT-026 | Visibilidade da aba: hidden → offline | `document.hidden = true` | Status muda para `offline` |

---

### 6.4 Testes End-to-End (E2E)

Fluxos completos de ponta a ponta no navegador real via **Playwright**.

#### 🔐 Fluxo de Autenticação

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-001 | Login com sucesso (admin) | 1. Navega para `/login` → 2. Preenche email admin → 3. Preenche senha → 4. Clica "Entrar" | Redireciona para Dashboard `/` |
| E2E-002 | Login com credenciais inválidas | 1. Preenche email errado → 2. Clica "Entrar" | Toast "E-mail ou senha incorretos" |
| E2E-003 | Login com campos vazios | 1. Clica "Entrar" sem preencher | Toast "Preencha e-mail e senha" |
| E2E-004 | Registro de novo usuário | 1. Navega para `/registro` → 2. Preenche todos os campos → 3. Submete | Redireciona para `/login` com toast de sucesso |
| E2E-005 | Fluxo esqueci senha | 1. Navega `/esqueci-senha` → 2. Informa email → 3. Submete | Toast de email enviado |
| E2E-006 | Logout | 1. Estando logado → 2. Clica logout na sidebar/perfil | Redireciona para `/login` |
| E2E-007 | Proteção de rotas | 1. Sem sessão → 2. Acessa `/projetos` | Redireciona para `/login` |
| E2E-008 | Toggle mostrar/ocultar senha | 1. Na tela de login → 2. Clica ícone olho | Input alterna entre `type=password` e `type=text` |

#### 📊 Fluxo de Dashboard

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-009 | Carrega KPIs do dashboard | 1. Login → 2. Aguarda carregamento | Cards com números de projetos, atividades, beneficiários visíveis |
| E2E-010 | Gráficos renderizam | 1. Login → 2. Scroll para gráficos | Componentes Recharts visíveis e preenchidos |
| E2E-011 | Colaboradores online exibidos | 1. Login admin + técnico | Seção de colaboradores lista ambos |

#### 📁 Fluxo de Projetos (CRUD Completo)

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-012 | Criar projeto | 1. `/projetos` → 2. "Novo Projeto" → 3. Preenche formulário → 4. Salva | Projeto aparece na listagem |
| E2E-013 | Visualizar detalhes do projeto | 1. Clica em um projeto | Detalhes do projeto exibidos (contrato, financiador, datas, valor) |
| E2E-014 | Editar projeto | 1. Abre projeto → 2. Clica "Editar" → 3. Altera nome → 4. Salva | Nome atualizado na listagem |
| E2E-015 | Excluir projeto (admin) | 1. Login admin → 2. Abre projeto → 3. "Excluir" → 4. Confirma | Projeto removido da listagem |
| E2E-016 | Exclui projeto por usuário técnico | 1. Login técnico → 2. Tenta excluir | Projeto excluído com sucesso (todos são admin) |
| E2E-017 | Vincular tecnologias ao projeto | 1. Cria/edita projeto → 2. Adiciona tecnologia na pivot | Tecnologia listada no projeto |
| E2E-018 | Filtrar projetos por status | 1. `/projetos` → 2. Filtra "Em execução" | Apenas projetos ativos |
| E2E-019 | Exportar projetos (PDF/Excel) | 1. Clica botão exportar | Arquivo baixado com dados |

#### 📋 Fluxo de Atividades

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-020 | Criar atividade vinculada a projeto | 1. `/atividades` → 2. "Nova Atividade" → 3. Seleciona projeto → 4. Preenche → 5. Salva | Atividade criada e listada |
| E2E-021 | Vincular beneficiários à atividade | 1. Edita atividade → 2. Adiciona beneficiários | Registros na pivot `atividade_beneficiarios` |
| E2E-022 | Vincular tecnologias à atividade | 1. Edita atividade → 2. Seleciona tecnologias | Registros na pivot `atividade_tecnologias` |
| E2E-023 | Editar atividade existente | 1. Abre atividade → 2. Modifica descrição → 3. Salva | Descrição atualizada |
| E2E-024 | Excluir atividade (admin) | 1. Login admin → 2. Exclui atividade | Atividade removida, pivots cascateiam |

#### ⚡ Fluxo de Ações Independentes

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-025 | Criar ação independente (sem projeto) | 1. `/acoes-independentes` → 2. "Nova Ação" → 3. Preenche sem projeto → 4. Salva | Ação listada sem vínculo de projeto |
| E2E-026 | Editar ação independente | 1. Abre ação → 2. Edita → 3. Salva | Dados atualizados |

#### 🌱 Fluxo de Tecnologias Sociais

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-027 | Listar tecnologias por linha de ação | 1. `/tecnologias` → 2. Filtra por "Agroecologia" | Tecnologias filtradas |
| E2E-028 | Criar nova tecnologia social | 1. "Nova Tecnologia" → 2. **Seleciona nome da lista (combobox)**, tipo, linha de ação → 3. Salva | Tecnologia criada com nome selecionado da lista |
| E2E-029 | Editar tecnologia existente | 1. Abre tecnologia → 2. **Seleciona novo nome da lista (combobox — não aceita texto livre)** → 3. Altera tipo entrega → 4. Salva | Nome selecionado da lista e tipo de entrega atualizados corretamente no Supabase |

> **⚠️ Nota sobre o campo "Nome da Tecnologia":** O campo "Nome da tecnologia" nos formulários de Tecnologia Social é um **combobox com opções predefinidas** — não aceita entrada de texto livre. Os testes E2E-028 e E2E-029 devem **selecionar uma opção existente da lista** em vez de tentar digitar um nome novo.

#### 👥 Fluxo de Cadastros (Beneficiários)

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-030 | Cadastrar beneficiário | 1. `/cadastros` → 2. "Novo Beneficiário" → 3. Preenche CPF, nome, gênero, faixa → 4. Salva | Beneficiário listado |
| E2E-031 | Rejeitar CPF/NIS duplicado | 1. Tenta cadastrar documento já existente | Toast de erro "documento já cadastrado" |
| E2E-032 | Editar dados de beneficiário | 1. Abre registro → 2. Altera comunidade → 3. Salva | Comunidade atualizada |
| E2E-033 | Buscar beneficiário por nome/documento | 1. Digita no campo de busca | Lista filtrada em tempo real |

#### 🖼️ Fluxo de Banco de Imagens

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-034 | Upload de imagem com metadados | 1. `/imagens` → 2. "Upload" → 3. Seleciona arquivo + preenche dados → 4. Salva | Imagem no bucket + metadados no banco |
| E2E-035 | Visualizar galeria de imagens | 1. `/imagens` | Grid de imagens com thumbnails |
| E2E-036 | Filtrar imagens por projeto | 1. Seleciona projeto no filtro | Apenas imagens daquele projeto |
| E2E-037 | Excluir imagem (admin) | 1. Admin clica excluir na imagem | Arquivo removido do bucket + registro |

#### 📄 Fluxo de Documentos

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-038 | Upload de documento | 1. `/documentos` → 2. Upload de PDF | Documento no bucket + metadados |
| E2E-039 | Download de documento | 1. Clica no documento listado | Download inicia corretamente |
| E2E-040 | Filtrar documentos por tipo de ação | 1. Seleciona tipo de ação | Documentos filtrados |

#### 📈 Fluxo de Indicadores

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-041 | Visualizar indicadores agregados | 1. `/indicadores` | Gráficos e cards com métricas corretas |
| E2E-042 | Gráficos refletem dados atuais | 1. Cria projeto → 2. Volta a indicadores | Números atualizados |

#### 👤 Fluxo de Usuários (Admin Only)

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-043 | Admin visualiza lista de usuários | 1. Login admin → 2. `/usuarios` | Lista de todos os perfis |
| E2E-044 | Admin altera role de usuário | 1. Seleciona usuário → 2. Altera role → 3. Salva | Role atualizado |
| E2E-045 | Técnico acessa `/usuarios` | 1. Login técnico → 2. Navega `/usuarios` | Lista de usuários carregada com sucesso (todos são admin) |

#### 🔒 Fluxo de Auditoria

| ID | Cenário | Passos | Resultado Esperado |
|----|---------|--------|--------------------|
| E2E-046 | Ação gera registro de auditoria | 1. Cria projeto → 2. Consulta tabela `auditoria` | Registro INSERT com `detalhes` contendo dados do projeto |
| E2E-047 | Edição gera registro com diff | 1. Edita projeto → 2. Consulta auditoria | Registro UPDATE com `old` e `new` em `detalhes` |

---

### 6.5 Testes de Acessibilidade

| ID | Cenário | Critério | Ferramenta |
|----|---------|----------|------------|
| A11Y-001 | Todas as imagens têm `alt` text | WCAG 2.1 1.1.1 | axe-core |
| A11Y-002 | Formulários possuem `label` associado | WCAG 2.1 1.3.1 | axe-core |
| A11Y-003 | Contraste de texto suficiente (light + dark) | WCAG 2.1 1.4.3 (AA) | axe-core |
| A11Y-004 | Navegação por teclado funcional | Tab order lógico | Manual + Playwright |
| A11Y-005 | Botões de toggle senha possuem `aria-label` | WCAG 2.1 4.1.2 | axe-core |
| A11Y-006 | Toasts (Sonner) são acessíveis como `role=status` | WCAG 2.1 4.1.3 | axe-core |

---

### 6.6 Testes Visuais / Responsividade

| ID | Cenário | Viewports | Resultado Esperado |
|----|---------|-----------|-------------------|
| VIS-001 | Layout responsivo do Dashboard | 360px, 768px, 1440px | Layout se adapta sem overflow |
| VIS-002 | Sidebar oculta em mobile | `< 768px` | Sidebar hidden, menu hamburger visível |
| VIS-003 | Formulários empilham em mobile | `< 768px` | Campos em coluna única |
| VIS-004 | Dark mode aplicado consistentemente | Toggle dark | Todas as seções usam variáveis CSS dark |
| VIS-005 | Tabelas com scroll horizontal em mobile | `< 768px` | Tabela rola horizontalmente |
| VIS-006 | Auth layout: split em desktop, single em mobile | 360px vs 1440px | Split em desktop, formulário único em mobile |

---

## 7. Testes de Back-End (Supabase)

### 7.1 Testes de Banco de Dados (Schema)

Verificações das constraints, tipos e relacionamentos definidos nas migrações.

#### Tabela `profiles`

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-001 | PK referencia `auth.users` | `INSERT INTO profiles (id, email) VALUES ('uuid-inexistente', 'x@x.com')` | ❌ Foreign key violation |
| DB-002 | `email` é obrigatório | `INSERT INTO profiles (id) VALUES (uuid)` | ❌ NOT NULL violation |
| DB-003 | `created_at` tem default `now()` | `INSERT` sem `created_at` | ✅ Timestamp preenchido automaticamente |

#### Tabela `projetos`

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-004 | `contrato` é UNIQUE | 2× INSERT com mesmo contrato | ❌ Unique violation |
| DB-005 | `status` restrito a enum | `INSERT` com `status='Cancelado'` | ❌ CHECK violation |
| DB-006 | `status` aceita valores válidos | `'Em execução'`, `'Concluído'`, `'Suspenso'` | ✅ Aceito |
| DB-007 | `valor` default 0 | INSERT sem `valor` | ✅ `valor = 0` |
| DB-008 | `municipios` é array | INSERT com `'{}'` | ✅ Array vazio aceito |

#### Tabela `beneficiarios`

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-009 | `documento_identificador` UNIQUE | 2× INSERT com mesmo doc | ❌ Unique violation |
| DB-010 | `genero` restrito a CHECK | `INSERT` com `genero='Outro2'` | ❌ CHECK violation |
| DB-011 | `faixa_etaria` restrita a CHECK | `INSERT` com `faixa_etaria='Criança'` | ❌ CHECK violation |
| DB-012 | `quilombola` default false | INSERT sem `quilombola` | ✅ `false` |

#### Tabela `tecnologias_sociais`

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-013 | `tipo_entrega` usa enum | `INSERT` com `tipo_entrega='Outra'` | ❌ Invalid enum value |
| DB-014 | `linha_de_acao_id` ON DELETE RESTRICT | DELETE linha de ação com tecnologias | ❌ Restrict violation |

#### Tabelas Pivot

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-015 | `atividade_beneficiarios` PK composta | 2× INSERT do mesmo par | ❌ PK violation |
| DB-016 | `atividade_tecnologias` PK composta | 2× INSERT do mesmo par | ❌ PK violation |
| DB-017 | Cascade em `projeto_tecnologias` | DELETE projeto | ✅ Registros pivot removidos |
| DB-018 | Cascade em `atividade_beneficiarios` | DELETE atividade | ✅ Registros pivot removidos |

#### Tabela `arquivos_midia`

| ID | Cenário | SQL de Teste | Resultado Esperado |
|----|---------|-------------|-------------------|
| DB-019 | `tipo_arquivo` restrito a CHECK | `INSERT` com `tipo_arquivo='video'` | ❌ CHECK violation |
| DB-020 | `projeto_id` ON DELETE SET NULL | DELETE projeto | ✅ `projeto_id = NULL`, registro mantido |

---

### 7.2 Testes de Row Level Security (RLS)

Validação das políticas de segurança em nível de linha.

#### Matriz de Permissões

| Tabela | SELECT (auth) | INSERT (auth) | UPDATE (auth) | DELETE (auth) |
|--------|:---:|:---:|:---:|:---:|
| `profiles` | ✅ todos | ✅ todos | ✅ todos | ✅ todos |
| `linhas_de_acao` | ✅ | ✅ | ✅ | ✅ |
| `tecnologias_sociais` | ✅ | ✅ | ✅ | ✅ |
| `projetos` | ✅ | ✅ | ✅ | ✅ |
| `projeto_tecnologias` | ✅ | ✅ | ✅ | ✅ |
| `beneficiarios` | ✅ | ✅ | ✅ | ✅ |
| `atividades` | ✅ | ✅ | ✅ | ✅ |
| `atividade_beneficiarios` | ✅ | ✅ | ✅ | ✅ |
| `atividade_tecnologias` | ✅ | ✅ | ✅ | ✅ |
| `arquivos_midia` | ✅ | ✅ | ✅ | ✅ |
| `auditoria` | ✅ | ✅ | ✅ | ✅ |

#### Cenários de Teste RLS

| ID | Cenário | Contexto | SQL / Ação | Resultado Esperado |
|----|---------|----------|-----------|-------------------|
| RLS-001 | Anon não lê projetos | Sem JWT | `SELECT * FROM projetos` | ❌ 0 linhas |
| RLS-002 | Todos os autenticados leem projetos | JWT auth | `SELECT * FROM projetos` | ✅ Todos os projetos |
| RLS-003 | Qualquer usuário autenticado cria projeto | JWT auth | `INSERT INTO projetos ...` | ✅ Inserido |
| RLS-004 | Qualquer usuário autenticado edita projeto | JWT auth | `UPDATE projetos SET ...` | ✅ Atualizado |
| RLS-005 | Qualquer usuário autenticado exclui projeto | JWT auth | `DELETE FROM projetos ...` | ✅ Excluído |
| RLS-007 | Usuário edita perfil | JWT auth | `UPDATE profiles SET ...` | ✅ Atualizado |
| RLS-008 | Usuário exclui perfil | JWT auth | `DELETE FROM profiles ...` | ✅ Excluído |
| RLS-009 | Qualquer usuário cria linha de ação | JWT auth | `INSERT INTO linhas_de_acao ...` | ✅ Inserido |

---

### 7.3 Testes de Autenticação

| ID | Cenário | Método | Resultado Esperado |
|----|---------|--------|-------------------|
| AUTH-001 | Login com email/senha válidos | `supabase.auth.signInWithPassword()` | Session + user retornados |
| AUTH-002 | Login com senha errada | `signInWithPassword()` com pwd errado | Erro `Invalid login credentials` |
| AUTH-003 | Login com email não cadastrado | `signInWithPassword()` | Erro `Invalid login credentials` |
| AUTH-004 | Registro de novo usuário | `supabase.auth.signUp()` | Usuário criado em `auth.users` |
| AUTH-005 | Trigger `handle_new_user` dispara | Após `signUp()` | Perfil criado em `profiles` automaticamente |
| AUTH-006 | `full_name` extraído de metadata | `signUp()` com `raw_user_meta_data.full_name` | `profiles.full_name` preenchido |
| AUTH-007 | `is_admin` default true para todos | `signUp()` | `profiles.is_admin = true` |
| AUTH-008 | Reset de senha via email | `supabase.auth.resetPasswordForEmail()` | Email enviado (verificar logs Supabase) |
| AUTH-009 | Atualizar senha | `supabase.auth.updateUser({ password })` | Senha alterada com sucesso |
| AUTH-010 | Sessão persiste após reload | Login → Reload página | `getSession()` retorna sessão válida |
| AUTH-011 | Auto-refresh de token | Aguardar expiração do access token | Token renovado automaticamente |
| AUTH-012 | `signOut()` invalida sessão | Após logout | `getSession()` retorna `null` |

---

### 7.4 Testes de Storage (Buckets)

| ID | Cenário | Bucket | Contexto | Resultado Esperado |
|----|---------|--------|----------|-------------------|
| STG-001 | Upload de imagem por autenticado | `imagens` | JWT válido | ✅ Arquivo criado |
| STG-002 | Upload de documento por autenticado | `documentos` | JWT válido | ✅ Arquivo criado |
| STG-003 | Upload por anônimo | `imagens` | Sem JWT | ❌ Unauthorized |
| STG-004 | Leitura pública de objeto | `imagens` | JWT válido | ✅ URL acessível |
| STG-005 | Delete por qualquer autenticado | `imagens` | JWT auth | ✅ Arquivo excluído |
| STG-006 | Upload em bucket não autorizado | `outro_bucket` | JWT válido | ❌ Policy violation |
| STG-007 | Upload com tipo de arquivo válido | `imagens` | JPG/PNG/WebP | ✅ Aceito |

---

### 7.5 Testes de Triggers e Auditoria

| ID | Cenário | Tabela | Operação | Resultado Esperado |
|----|---------|--------|----------|-------------------|
| AUD-001 | INSERT gera log | `projetos` | INSERT | Registro em `auditoria` com `acao='INSERT'`, `detalhes=to_jsonb(NEW)` |
| AUD-002 | UPDATE gera log com diff | `projetos` | UPDATE | Registro com `detalhes={old: ..., new: ...}` |
| AUD-003 | DELETE gera log | `projetos` | DELETE | Registro com `acao='DELETE'`, `detalhes=to_jsonb(OLD)` |
| AUD-004 | Auditoria registra `usuario_id` | qualquer | INSERT/UPDATE/DELETE | `usuario_id = auth.uid()` |
| AUD-005 | Trigger ativo em `tecnologias_sociais` | `tecnologias_sociais` | INSERT | Registro de auditoria criado |
| AUD-006 | Trigger ativo em `beneficiarios` | `beneficiarios` | UPDATE | Registro de auditoria criado |
| AUD-007 | Trigger ativo em `atividades` | `atividades` | DELETE | Registro de auditoria criado |
| AUD-008 | Trigger ativo em `arquivos_midia` | `arquivos_midia` | INSERT | Registro de auditoria criado |
| AUD-009 | `handle_new_user` cria perfil | `auth.users` | INSERT | Perfil em `profiles` com dados corretos |

---

### 7.6 Testes de Realtime / Presence

| ID | Cenário | Ação | Resultado Esperado |
|----|---------|------|--------------------|
| RT-001 | Canal presence aceita subscription | `supabase.channel().subscribe()` | Status `SUBSCRIBED` |
| RT-002 | Track de presença sincroniza | 2 clientes conectam | Ambos veem um ao outro |
| RT-003 | Untrack ao desconectar | Cliente fecha aba | Outros clientes removem o usuário da lista |
| RT-004 | Heartbeat `last_seen` persiste | Após 2 min conectado | `profiles.last_seen` atualizado |

---

## 8. Cenários de Teste Detalhados

### 8.1 Módulo de Autenticação

#### TC-LOGIN-001: Login com sucesso (Admin)

```
Pré-condição: Usuário cadastrado no sistema
Passos:
  1. Acessar /login
  2. Informar email/senha
  3. Clicar "Entrar"
Resultado Esperado:
  - Toast "Bem-vindo de volta!" exibido
  - Redirecionamento para Dashboard (/)
  - Sidebar exibe todos os itens incluindo "Usuários"
  - Avatar do usuário visível no header
Pós-condição: Sessão ativa no localStorage
```

#### TC-LOGIN-002: Login com credenciais inválidas

```
Pré-condição: Nenhuma sessão ativa
Passos:
  1. Acessar /login
  2. Informar email: email@ongchapada.org.br
  3. Informar senha: senha_errada
  4. Clicar "Entrar"
Resultado Esperado:
  - Toast "E-mail ou senha incorretos." exibido
  - Permanece na página /login
  - Campos não são limpos
Pós-condição: Nenhuma sessão criada
```

#### TC-LOGIN-003: Proteção de rota autenticada

```
Pré-condição: Nenhuma sessão ativa
Passos:
  1. Acessar diretamente /projetos via URL
Resultado Esperado:
  - Redirecionamento automático para /login
  - Nenhum conteúdo protegido exibido
```

---

### 8.2 Dashboard

#### TC-DASH-001: Carregamento de métricas

```
Pré-condição: Login usuário, pelo menos 1 projeto e 1 atividade no banco
Passos:
  1. Acessar Dashboard (/)
  2. Aguardar carregamento completo
Resultado Esperado:
  - Card "Projetos" exibe contagem > 0
  - Card "Atividades" exibe contagem > 0
  - Card "Beneficiários" exibe contagem >= 0
  - Gráficos de Recharts renderizados
  - Lista de atividades recentes visível
```

---

### 8.3 Projetos

#### TC-PROJ-001: CRUD completo de projeto

```
Pré-condição: Login usuário
Passos:
  CREATE:
    1. Navegar para /projetos
    2. Clicar "Novo Projeto"
    3. Preencher: Nome="Projeto Teste", Contrato="CT-001/2026", 
       Financiador="BNDES", Início="01/01/2026", Término="31/12/2026",
       Valor=150000, Status="Em execução"
    4. Salvar
  READ:
    5. Verificar projeto na listagem
    6. Clicar para abrir detalhes
  UPDATE:
    7. Clicar "Editar"
    8. Alterar Valor para 200000
    9. Salvar
  DELETE:
    10. Clicar "Excluir"
    11. Confirmar exclusão
Resultado Esperado:
  - Projeto criado e visível na lista
  - Detalhes corretos exibidos
  - Valor atualizado após edição
  - Projeto removido após exclusão
  - 3 registros de auditoria (INSERT, UPDATE, DELETE) criados
```

---

### 8.4 Atividades

#### TC-ATIV-001: Criar atividade com vínculos

```
Pré-condição: Login usuário, pelo menos 1 projeto e 1 beneficiário existem
Passos:
  1. Navegar para /atividades
  2. Clicar "Nova Atividade"
  3. Selecionar projeto existente
  4. Preencher: Data="05/06/2026", Tipo="Capacitação", 
     Descrição="Oficina de manejo", Local="Comunidade X", Município="Ouricuri"
  5. Vincular 2 beneficiários
  6. Vincular 1 tecnologia social
  7. Salvar
Resultado Esperado:
  - Atividade criada em `atividades`
  - 2 registros em `atividade_beneficiarios`
  - 1 registro em `atividade_tecnologias`
  - Toast de sucesso exibido
```

---

### 8.5 Ações Independentes

#### TC-ACIND-001: Criar ação independente

```
Pré-condição: Login autenticado
Passos:
  1. Navegar para /acoes-independentes
  2. Clicar "Nova Ação"
  3. Preencher dados sem vincular projeto
  4. Salvar
Resultado Esperado:
  - Ação criada e listada na página
  - Campo projeto_id = null no banco
```

---

### 8.6 Tecnologias Sociais

#### TC-TECH-001: Listagem com dados iniciais (seed)

```
Pré-condição: Login autenticado, dados seed executados
Passos:
  1. Navegar para /tecnologias
  2. Aguardar carregamento
Resultado Esperado:
  - 22 tecnologias sociais listadas
  - 9 linhas de ação representadas
  - Filtro por linha de ação funciona
  - Tipos "Física" e "Metodológica" exibidos corretamente
```

---

### 8.7 Cadastros (Beneficiários)

#### TC-CAD-001: Validação de documento único

```
Pré-condição: Login autenticado, beneficiário com CPF "12345678901" existe
Passos:
  1. Navegar para /cadastros
  2. Clicar "Novo Beneficiário"
  3. Informar documento_identificador="12345678901"
  4. Preencher demais campos
  5. Salvar
Resultado Esperado:
  - Erro exibido indicando documento já cadastrado
  - Nenhum registro duplicado no banco
```

---

### 8.8 Banco de Imagens

#### TC-IMG-001: Upload e visualização de imagem

```
Pré-condição: Login autenticado
Passos:
  1. Navegar para /imagens
  2. Clicar "Upload"
  3. Selecionar arquivo JPG (< 5MB)
  4. Preencher: Projeto, Tipo de Ação, Local, Data
  5. Salvar
Resultado Esperado:
  - Arquivo salvo no bucket `imagens`
  - Registro em `arquivos_midia` com tipo_arquivo='imagem'
  - Imagem exibida na galeria
  - URL pública acessível
```

---

### 8.9 Documentos

#### TC-DOC-001: Upload e download de documento

```
Pré-condição: Login autenticado
Passos:
  1. Navegar para /documentos
  2. Fazer upload de PDF
  3. Verificar na listagem
  4. Clicar para download
Resultado Esperado:
  - Arquivo salvo no bucket `documentos`
  - Registro em `arquivos_midia` com tipo_arquivo='documento'
  - Download funciona corretamente
```

---

### 8.10 Indicadores

#### TC-IND-001: Gráficos refletem dados reais

```
Pré-condição: Login autenticado, dados existentes no banco
Passos:
  1. Navegar para /indicadores
  2. Verificar gráficos e métricas
Resultado Esperado:
  - Gráficos renderizados (Recharts)
  - Números coerentes com dados do banco
  - Sem erros de console
```

---

### 8.11 Usuários (Admin)

#### TC-USR-001: Controle de acesso por role

Pré-condição: Login como qualquer usuário cadastrado
Passos:
  1. Navegar para /usuarios
Resultado Esperado:
  - Rota acessível e lista de usuários carregada com sucesso (todos são admin)

---

### 8.12 Auditoria

#### TC-AUD-001: Registro automático de ações

```
Pré-condição: Login admin
Passos:
  1. Criar um projeto
  2. Editar o projeto
  3. Excluir o projeto
  4. Consultar tabela auditoria via SQL
Resultado Esperado:
  - 3 registros: INSERT, UPDATE, DELETE
  - Cada registro contém usuario_id, acao, tabela, registro_id, detalhes
  - UPDATE contém old/new no campo detalhes (jsonb)
```

---

## 9. Critérios de Aceite Globais

| # | Critério | Descrição |
|---|----------|-----------|
| 1 | **Zero erros críticos** | Nenhum crash, loop infinito, ou perda de dados em fluxos normais |
| 2 | **RLS 100% funcional** | Técnicos não conseguem deletar registros em nenhuma tabela |
| 3 | **Rotas protegidas** | Nenhuma rota interna acessível sem autenticação |
| 4 | **Responsividade** | Interface funcional em 360px–1920px |
| 5 | **Dark/Light mode** | Ambos os temas sem problemas visuais (contraste, legibilidade) |
| 6 | **Auditoria completa** | Toda operação CUD em tabelas monitoradas gera registro de auditoria |
| 7 | **Dados seed corretos** | Usuários admin/técnico funcionais, 22 tecnologias, 9 linhas de ação |
| 8 | **Performance aceitável** | Carregamento inicial < 3s, navegação entre páginas < 1s |
| 9 | **Validação de formulários** | Campos obrigatórios exigidos, CPF/NIS único, enums respeitados |
| 10 | **Toasts informativos** | Feedback visual para toda ação (sucesso, erro, loading) |

---

## 10. Plano de Regressão

### Testes a executar em cada PR/Deploy

| Prioridade | Testes | Frequência |
|-----------|--------|------------|
| 🔴 **Críticos** | Login/Logout, CRUD projetos, RLS admin/técnico, proteção de rotas | Toda PR |
| 🟡 **Importantes** | CRUD atividades/beneficiários, upload storage, auditoria | PRs que tocam back-end |
| 🟢 **Secundários** | Responsividade, dark mode, indicadores, acessibilidade | Releases |

### Gatilhos de Regressão Completa

- Atualização de migrações SQL
- Alteração de políticas RLS
- Mudança no `AuthContext` ou `router`
- Upgrade de dependências (React, Supabase, TanStack)

---

## 11. Métricas de Qualidade

| Métrica | Meta | Ferramenta |
|---------|------|-----------|
| Cobertura de código (linhas) | ≥ 70% | Vitest (c8) |
| Cobertura de branches | ≥ 60% | Vitest (c8) |
| Testes E2E passando | 100% | Playwright |
| Testes unitários passando | 100% | Vitest |
| Tempo total de CI | < 10 min | GitHub Actions |
| Bugs P0 em produção | 0 por sprint | Monitoramento |
| Acessibilidade (axe) | 0 violations critical/serious | axe-core |

---

## Anexo A: Estrutura de Arquivos de Teste Sugerida

```
📁 Projeto-Chapada-main/
├── 📁 src/
│   ├── 📁 __tests__/              ← Testes unitários e de componentes
│   │   ├── 📁 lib/
│   │   │   ├── utils.test.ts
│   │   │   ├── progress.test.ts
│   │   │   └── projetosStore.test.ts
│   │   ├── 📁 hooks/
│   │   │   ├── use-debounce.test.ts
│   │   │   └── use-mobile.test.ts
│   │   ├── 📁 components/
│   │   │   ├── AppSidebar.test.tsx
│   │   │   ├── ThemeToggle.test.tsx
│   │   │   ├── AuthLayout.test.tsx
│   │   │   └── ProfileModal.test.tsx
│   │   └── 📁 contexts/
│   │       └── AuthContext.test.tsx
├── 📁 e2e/                        ← Testes E2E (Playwright)
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   ├── projetos.spec.ts
│   ├── atividades.spec.ts
│   ├── cadastros.spec.ts
│   ├── imagens.spec.ts
│   ├── documentos.spec.ts
│   ├── tecnologias.spec.ts
│   ├── indicadores.spec.ts
│   ├── usuarios.spec.ts
│   └── accessibility.spec.ts
├── 📁 supabase/
│   └── 📁 tests/                  ← Testes de banco de dados (pgTAP ou SQL)
│       ├── schema.test.sql
│       ├── rls.test.sql
│       ├── triggers.test.sql
│       └── auth.test.sql
├── vitest.config.ts               ← Config do Vitest
├── playwright.config.ts           ← Config do Playwright
└── ESPECIFICACAO_TESTES.md        ← Este documento
```

---

## Anexo B: Configuração Inicial Recomendada

### Vitest (`vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/routeTree.gen.ts', 'src/components/ui/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

### Playwright (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

> **📌 Nota:** Este documento deve ser atualizado conforme novas funcionalidades forem adicionadas ao sistema. Cada nova feature deve vir acompanhada de seus cenários de teste antes da implementação (TDD/BDD).
