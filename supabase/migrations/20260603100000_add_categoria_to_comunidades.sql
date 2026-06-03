-- Migração para adicionar a coluna categoria à tabela comunidades
ALTER TABLE public.comunidades ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Comunidade';

-- Adicionar constraint de check para garantir valores aceitos (opcional, mas boa prática)
ALTER TABLE public.comunidades DROP CONSTRAINT IF EXISTS comunidades_categoria_check;
ALTER TABLE public.comunidades ADD CONSTRAINT comunidades_categoria_check CHECK (categoria IN ('Comunidade', 'Local/Espaço'));
