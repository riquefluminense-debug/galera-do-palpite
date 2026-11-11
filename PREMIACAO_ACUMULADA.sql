-- Executar uma vez no SQL Editor do Supabase. Preserva dados existentes.
ALTER TABLE public.rodadas ADD COLUMN IF NOT EXISTS premiacao_config jsonb DEFAULT NULL;
