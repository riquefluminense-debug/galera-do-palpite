-- Execute uma vez no SQL Editor do Supabase.
create table if not exists public.campeoes_premios (
 id uuid primary key,
 nome text not null check (length(trim(nome)) between 3 and 120),
 valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 100000000),
 created_at timestamptz not null default now()
);
alter table public.campeoes_premios enable row level security;
revoke all on public.campeoes_premios from anon, authenticated;
grant select, insert, update, delete on public.campeoes_premios to service_role;
-- Sem escrita pública. Somente o servidor usa a chave service_role.

-- Compatibilidade se você já executou a versão anterior do SQL.
alter table public.campeoes_premios alter column created_at set default now();
alter table public.campeoes_premios add column if not exists rodada text;
alter table public.campeoes_premios add column if not exists data_pagamento date;
alter table public.campeoes_premios alter column rodada drop not null;
alter table public.campeoes_premios alter column data_pagamento drop not null;
