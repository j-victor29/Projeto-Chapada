# Configuração de Testes de Back-end (Supabase)

Como o sistema CHAPADA utiliza **Supabase** como back-end (BaaS), a API REST é gerada automaticamente pelo PostgREST. A URL do Vercel que você mencionou (`https://project-chapada-system-mh4y.vercel.app/`) é do **Front-end**. Para testar o **Back-end (APIs)**, você deve usar as credenciais do Supabase.

Abaixo estão os dados preenchidos para você copiar e colar na sua ferramenta de testes de IA:

---

### Tipo de teste
**Backend (APIs)**

### URL base da API
Copie e cole a URL REST do seu banco de dados Supabase:
```text
https://vaibjtbayfpmvxxbtuxi.supabase.co/rest/v1
```

### Documentação da API de upload (Recomendado)
O Supabase gera uma documentação OpenAPI (Swagger) automaticamente. Para o agente de IA ler os seus endpoints, salve a especificação e faça o upload.
**Como obter o arquivo:**
1. Acesse o link abaixo no seu navegador (ele contém a sua chave pública anônima):
   `https://vaibjtbayfpmvxxbtuxi.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaWJqdGJheWZwbXZ4eGJ0dXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDcxMzgsImV4cCI6MjA5NTEyMzEzOH0.4RkOJxazUZ64OEF7Z4VhZZq5mfXlH0f6xTjVPK0lFYo`
2. O navegador mostrará um grande arquivo JSON. Clique com o botão direito, selecione "Salvar como..." e salve como `swagger.json`.
3. Faça o upload desse arquivo `swagger.json` no campo **Documentação da API de upload**.

### Instruções adicionais para o teste
*Copie e cole o texto abaixo exatamente como está no campo de instruções adicionais da plataforma:*

```text
O back-end utiliza Supabase (PostgREST). Por favor, siga rigorosamente estas regras ao testar:

1. HEADERS OBRIGATÓRIOS:
- Todas as requisições para qualquer endpoint DEVEM incluir o header: `apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhaWJqdGJheWZwbXZ4eGJ0dXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDcxMzgsImV4cCI6MjA5NTEyMzEzOH0.4RkOJxazUZ64OEF7Z4VhZZq5mfXlH0f6xTjVPK0lFYo`
- Para requisições autenticadas, adicione o header: `Authorization: Bearer <TOKEN_GERADO>`

2. AUTENTICAÇÃO E RLS (Row Level Security):
- Todas as tabelas possuem Row Level Security (RLS) habilitado.
- Teste requisições anônimas (sem o header Authorization). O esperado é que requisições GET retornem arrays vazios [] (Status 200) e que POST/PATCH/DELETE retornem erro de permissão.
- Para gerar um token Bearer válido para testes, faça primeiro um POST para `https://vaibjtbayfpmvxxbtuxi.supabase.co/auth/v1/token?grant_type=password` passando `email` e `password` de um usuário de teste (ex: admin@ongchapada.org.br / chapada2026), capturando o `access_token` retornado.

3. FOCO DOS TESTES:
- Teste operações CRUD nas principais tabelas: `/projetos`, `/atividades`, `/beneficiarios`, `/tecnologias_sociais`.
- Valide Constraints do banco:
  - Tente criar dois `/projetos` com o mesmo `contrato` (deve falhar por violação de UNIQUE).
  - Tente criar dois `/beneficiarios` com o mesmo `documento_identificador` (deve falhar).
  - Teste a criação de `/projetos` com um status inválido (diferente de 'Em execução', 'Concluído', 'Suspenso') - deve falhar na validação do Enum.
- Teste relacionamentos N:N: Tente inserir registros nas tabelas pivot `/atividade_beneficiarios` e `/atividade_tecnologias`.
- Teste injeção SQL ou manipulação via querystring (ex: `?select=*` no PostgREST).

4. MODO DE RESPOSTA DO POSTGREST:
- Para que o POST/PATCH retorne os dados inseridos/atualizados, adicione o header `Prefer: return=representation`. Sem isso, o Supabase retorna 201 Created vazio.
```

---

### Dica para o teste
Você precisará garantir que a IA consiga fazer o processo de Login (via API de Auth do Supabase) antes de tentar gravar dados, senão as políticas RLS do banco vão bloquear todas as ações de gravação. O texto acima já orienta a IA sobre como buscar esse token!
