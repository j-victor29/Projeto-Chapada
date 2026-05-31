-- Alter status check constraint on projetos to support 'Planejamento'
ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS projetos_status_check;
ALTER TABLE public.projetos ADD CONSTRAINT projetos_status_check CHECK (status IN ('Planejamento', 'Em execução', 'Concluído', 'Suspenso'));

-- Add comunidades_atendidas column to projetos table
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS comunidades_atendidas text[] NOT NULL DEFAULT '{}';

-- Add titulo column to atividades table
ALTER TABLE public.atividades ADD COLUMN IF NOT EXISTS titulo text;
