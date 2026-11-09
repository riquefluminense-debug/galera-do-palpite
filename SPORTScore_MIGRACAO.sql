-- Executar uma vez no SQL Editor do Supabase. Não remove ou altera resultados existentes.
alter table public.jogos add column if not exists sportscore_url text;
alter table public.jogos add column if not exists sportscore_inicio timestamptz;
alter table public.jogos add column if not exists sportscore_ativo boolean not null default false;
alter table public.jogos add column if not exists placar_status text;
alter table public.jogos add column if not exists placar_detalhe text;
alter table public.jogos add column if not exists placar_atualizado_em timestamptz;
