# Sistema CHAPADA

Sistema de gestão do Centro de Habilitação e Apoio ao Pequeno Agricultor do Araripe (CHAPADA), com acompanhamento de projetos, atividades, tecnologias sociais, documentos, imagens e indicadores.

## Tecnologias

- React 19 e TypeScript
- Vite e Tailwind CSS
- TanStack Router e TanStack Query
- Supabase (banco de dados, autenticação e armazenamento)
- Vercel

## Execução local

1. Instale as dependências:

```bash
npm install
```

2. Inicie o projeto:

```bash
npm run dev
```

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm run format
```

## Estrutura

- `src/`: aplicação React
- `public/`: arquivos públicos estáticos
- `supabase/migrations/`: histórico versionado do banco de dados
- `docs/`: documentação técnica e operacional
- `artifacts/`: diagramas, especificações e referências do banco

As credenciais locais ficam no arquivo `.env`, que não é versionado. O arquivo `.env.example` contém apenas os nomes das variáveis necessárias.

Consulte [DOCUMENTACAO.md](DOCUMENTACAO.md) para a documentação técnica completa.
