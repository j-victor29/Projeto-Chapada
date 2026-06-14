# Procedimentos de Backup e Restore - Supabase / Postgres

Este documento descreve as rotinas e comandos para backup (cópia de segurança) e restore (recuperação) do banco de dados e do storage do sistema **CHAPADA**.

## 1. Backups Automáticos do Supabase
Na infraestrutura gerenciada do Supabase, o backup do banco de dados é automatizado:
* **Frequência:** Diária (Backups físicos).
* **Retenção:** 
  * Plano Free: Sem backups automáticos acessíveis pelo painel (requer backup manual).
  * Plano Pro: Retenção de 7 dias.
  * Plano Enterprise: Retenção de 30 dias.
* **Storage (Arquivos):** Os arquivos no Supabase Storage estão em buckets na nuvem do AWS S3, que possuem replicação interna, mas não são contemplados no backup automático de banco de dados. Devem ser sincronizados ou exportados separadamente.

---

## 2. Backup Manual (Banco de Dados)
Para realizar backups sob demanda ou programados fora do serviço gerenciado, utilize a ferramenta oficial CLI do Supabase ou `pg_dump`.

### Opção A: Utilizando a CLI do Supabase (Recomendado)
A CLI do Supabase baixa os dados estruturados e tabelas perfeitamente.

```bash
# 1. Login na CLI do Supabase
supabase login

# 2. Executar o backup do banco de dados remoto
# Substitua <project-ref> pela ID do projeto (ex.: vaibjtbayfpmvxxbtuxi)
supabase db dump --project-ref vaibjtbayfpmvxxbtuxi -f backup_esquema.sql

# 3. Executar o backup apenas dos dados (seed/registros)
supabase db dump --project-ref vaibjtbayfpmvxxbtuxi --data-only -f backup_dados.sql
```

### Opção B: Utilizando `pg_dump` clássico do Postgres
Se você tiver a string de conexão direta do banco remoto (disponível nas configurações do projeto Supabase):

```bash
# Backup completo (schema + dados)
pg_dump "postgresql://postgres:[SENHA_DB]@db.vaibjtbayfpmvxxbtuxi.supabase.co:5432/postgres" -F c -b -v -f "backup_chapada_$(date +%F).dump"
```

---

## 3. Restore (Recuperação de Desastres)

> [!CAUTION]
> A restauração de banco de dados sobrescreve dados existentes. Sempre faça um backup de segurança do estado atual antes de prosseguir com qualquer processo de restore.

### Restauração via CLI do Supabase

```bash
# Aplicar o arquivo de backup SQL em sua instância local ou remota
supabase db reset --db-url "postgresql://postgres:[SENHA_DB]@db.vaibjtbayfpmvxxbtuxi.supabase.co:5432/postgres"
```

### Restauração via `pg_restore` (Para arquivos .dump)

```bash
# Limpar esquema e restaurar do dump compactado
pg_restore -d "postgresql://postgres:[SENHA_DB]@db.vaibjtbayfpmvxxbtuxi.supabase.co:5432/postgres" -c -v "backup_chapada_2026-06-14.dump"
```

---

## 4. Backup do Storage (Mídias e Documentos)
O Supabase Storage armazena arquivos que não estão diretamente no Postgres (apenas os metadados estão na tabela `storage.objects`). Para fazer o backup dos arquivos físicos dos buckets `imagens` e `documentos`:

1. Utilize um script em Node.js ou Python que interaja com a biblioteca `@supabase/supabase-js`.
2. O script deve listar todos os objetos nos buckets `imagens` e `documentos` e baixá-los recursivamente para uma pasta local segura.
3. Exemplo de script de exportação automatizada:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient('VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');

async function backupBucket(bucketName) {
  const { data: files, error } = await supabase.storage.from(bucketName).list();
  if (error) throw error;

  for (const file of files) {
    const { data, error: downloadError } = await supabase.storage.from(bucketName).download(file.name);
    if (downloadError) continue;
    
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(path.join(__dirname, 'backups', bucketName, file.name), buffer);
  }
}
```
