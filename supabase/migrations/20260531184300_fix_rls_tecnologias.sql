-- ============================================================
-- MIGRATION DE CORREÇÃO: RLS PARA SELECT EM TECNOLOGIAS SOCIAIS
-- O problema: após inserção de uma tecnologia, a política de SELECT 
-- faltante causava o retorno "null" para tabelas recém-criadas, 
-- fazendo os dados sumirem da tela (ficando com o nome vazio).
-- ============================================================

-- Garante que o usuário autenticado pode LER as tecnologias do catálogo
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.tecnologias_sociais;
CREATE POLICY "Leitura por autenticados" ON public.tecnologias_sociais 
FOR SELECT TO authenticated USING (true);

-- Garante que o usuário autenticado pode LER as tecnologias vinculadas aos projetos
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.projeto_tecnologias;
CREATE POLICY "Leitura por autenticados" ON public.projeto_tecnologias 
FOR SELECT TO authenticated USING (true);
