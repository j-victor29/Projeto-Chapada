# APIs e Integrações do Sistema

O Sistema CHAPADA opera exclusivamente via chamadas client-side assíncronas do React utilizando a biblioteca oficial `@supabase/supabase-js`. 

## 1. Clientes e Conectores do Supabase
O conector do cliente está localizado em `src/integrations/supabase/client.ts`. Ele encapsula a inicialização utilizando as variáveis de ambiente com o prefixo `VITE_` e gerencia a persistência da sessão JWT do usuário:

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

---

## 2. Exemplos de Uso das APIs

### Listagem de Projetos (Comunicação Direta)
No store `src/lib/projetosStore.ts`, a busca e filtragem de projetos utiliza a sintaxe fluida do cliente:
```typescript
import { supabase } from "@/integrations/supabase/client";

export async function fetchProjetos() {
  const { data, error } = await supabase
    .from("projetos")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  return data;
}
```

### Upload de Arquivos para o Storage (Imagens e Documentos)
O upload do arquivo físico é realizado primeiro no storage, seguido de uma inserção de metadados na tabela correspondente:
```typescript
// Upload do arquivo para o bucket 'documentos'
const { data: storageData, error: storageError } = await supabase.storage
  .from("documentos")
  .upload(`public/${fileName}`, fileBlob);

if (storageError) throw storageError;

// Inserção do registro na tabela 'documentos' com a URL pública
const { error: dbError } = await supabase
  .from("documentos")
  .insert({
    titulo: fileName,
    storage_path: storageData.path,
    tamanho: fileBlob.size,
    mime_type: fileBlob.type
  });
```

---

## 3. OpenAPI Spec
A especificação completa das rotas descobertas e schemas está salva no arquivo de artefato [openapi.yaml](../artifacts/openapi.yaml).
