# Infraestrutura, Deployment e Operações

## 1. Descrição dos Ambientes

* **Desenvolvimento (Dev):** 
  * Executado localmente via `npm run dev` (Vite dev server) conectado à instância de banco de dados do Supabase.
* **Hospedagem e Produção (Hosting):**
  * O front-end da aplicação está configurado para deploy contínuo no **Vercel** (`vercel.json` configurado na raiz do projeto).
  * O backend e o banco de dados estão hospedados na nuvem gerenciada do **Supabase** na região `us-west-2` (Oregon, AWS).
  * O armazenamento de arquivos (documentos PDFs e imagens) está nos buckets de **Supabase Storage**.

---

## 2. Processo de Deployment e CI/CD

O deploy é acionado automaticamente a cada alteração ou merge na branch `main`:
1. **Build Step:** O Vercel clona o repositório, executa o comando `npm run build` compilando o bundle SPA estático da aplicação React utilizando o Vite.
2. **Asset CDN:** O bundle é distribuído globalmente na rede de borda (CDN) da Vercel.
3. **Database Migrations:** Modificações de esquema e triggers no Postgres devem ser aplicadas utilizando a CLI do Supabase localmente ou executando os scripts SQL do diretório `supabase/migrations` diretamente na dashboard do Supabase.

---

## 3. Checklist de Onboarding para Novos Desenvolvedores
Para começar a trabalhar no projeto localmente, siga estes passos:

1. **Clone do Repositório:**
   ```bash
   git clone https://github.com/j-victor29/Projeto-Chapada-main.git
   cd Projeto-Chapada-main
   ```
2. **Instalar Dependências:**
   Instale os pacotes necessários utilizando o npm ou bun:
   ```bash
   npm install
   ```
3. **Configuração de Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto contendo as chaves públicas da API do projeto no Supabase (copie do arquivo modelo ou solicite ao administrador):
   ```ini
   VITE_SUPABASE_URL="https://vaibjtbayfpmvxxbtuxi.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="sua_chave_anon_aqui"
   ```
4. **Executar a Aplicação:**
   Inicie o servidor de desenvolvimento local:
   ```bash
   npm run dev
   ```
   Acesse a URL exibida no terminal (geralmente `http://localhost:5173`).

---

## 4. Conformidade com LGPD / GDPR
Como o sistema manipula dados pessoais de cidadãos (nome, CPF, NIS, gênero, faixa etária e comunidade rural de residência), as seguintes medidas de governança são recomendadas para manter a conformidade com a Lei Geral de Proteção de Dados (LGPD):
* **Finalidade e Necessidade:** O registro de CPF e NIS é feito exclusivamente para evitar contagem dupla de famílias atendidas no cálculo de indicadores de impacto social exigidos pelos financiadores públicos.
* **Direito de Eliminação:** Caso um beneficiário solicite a exclusão de seus dados pessoais, o sistema possibilita que os administradores realizem a remoção direta do beneficiário da tabela `beneficiarios`. Devido às chaves estrangeiras com `ON DELETE CASCADE`, a exclusão removerá de forma segura e imediata as participações em pivots de atividades (`atividade_beneficiarios`), sem deixar órfãos de dados pessoais.
* **Segurança de Trânsito:** Todo o tráfego de dados entre o navegador do usuário e o Supabase é criptografado utilizando o protocolo TLS (HTTPS / WSS).
