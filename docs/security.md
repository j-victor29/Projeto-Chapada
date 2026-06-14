# Segurança e Autenticação

## 1. Mecanismo de Autenticação
O sistema utiliza o **Supabase Auth** como provedor de identidade (IdP) e segurança de sessão:
* **Fluxo de Login:** Baseado em e-mail e senha de forma padrão. Os dados de login geram tokens de acesso JWT assinados, contendo a role (`authenticated`) e metadados.
* **Persistência de Sessão:** A sessão é persistida em `localStorage` e renovada automaticamente por meio do fluxo de `refresh_token` do SDK client do Supabase.
* **Criação de Perfis Automática:** O trigger de banco de dados `on_auth_user_created` gerencia a inserção sincronizada de dados na tabela `public.profiles` a partir de `auth.users`.

---

## 2. Controle de Acesso e RLS (Row Level Security)
Originalmente o sistema possuía regras complexas baseadas na flag `is_admin`. Contudo, conforme a migração `20260603210000_simplificacao_roles_e_presenca.sql`, a lógica foi simplificada para conceder acesso total a qualquer usuário autenticado (colaboradores e administradores possuem privilégios similares no banco de dados, sendo `is_admin()` uma função que sempre retorna `true` para autenticados).

### Matriz de RLS por Tabela:
* **`profiles` / `projetos` / `atividades` / `beneficiarios`:** RLS Ativado. Qualquer usuário autenticado (`TO authenticated`) tem permissões totais para `SELECT`, `INSERT`, `UPDATE` e `DELETE`.
* **Buckets do Storage:** `imagens` e `documentos` possuem acesso de leitura público para autenticados e permissão de upload para autenticados. A exclusão de arquivos físicos de storage permanece restrita à lógica interna.

---

## 3. Riscos de Segurança Identificados e Mitigação

> [!WARNING]
> **Risco de RLS Desabilitado em `registro_colaboradores`**
> A tabela `public.registro_colaboradores` possui o RLS desativado. Isso significa que qualquer cliente autenticado ou anônimo com acesso à chave pública da API (`anon key`) pode ler, inserir ou excluir qualquer linha desta tabela, sem restrições.

### Remediação Proposta:
Para corrigir a vulnerabilidade da tabela `registro_colaboradores`, execute a seguinte instrução SQL no console do Supabase para habilitar o RLS e criar uma política que restrinja o acesso a usuários autenticados:

```sql
-- 1. Habilitar o Row Level Security na tabela
ALTER TABLE public.registro_colaboradores ENABLE ROW LEVEL SECURITY;

-- 2. Permitir que qualquer usuário autenticado leia e modifique as permissões de colaboração
CREATE POLICY "Autenticados gerenciam colaboradores" 
  ON public.registro_colaboradores 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);
```
*(Nota: Essa correção limita a exploração anônima e restringe a visibilidade e controle de permissões de colaboração apenas à equipe interna).*
