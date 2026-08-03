-- STE-8: direct-Postgres application shell. `clio_app` is deliberately NOLOGIN;
-- deployments provide its credential out of band. Local verification connects as
-- postgres and SET LOCAL ROLE clio_app so no password is committed.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'clio_app') then
    create role clio_app nologin noinherit;
  end if;
end $$;

create table public.fixture_organizations (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key,
  organization_id text not null references public.fixture_organizations(id),
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.messages (
  id uuid primary key,
  organization_id text not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) > 0),
  client_message_id text,
  run_id uuid,
  created_at timestamptz not null default now(),
  foreign key (organization_id, conversation_id)
    references public.conversations(organization_id, id) on delete cascade,
  unique (organization_id, client_message_id)
);

create table public.planning_runs (
  id uuid primary key,
  organization_id text not null,
  conversation_id uuid not null,
  client_message_id text not null,
  runtime text not null check (runtime in ('fixture', 'provider')),
  status text not null check (status in ('running', 'completed', 'failed', 'cancelled')),
  retry_of uuid references public.planning_runs(id),
  provider_response_id text,
  provider_request_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (organization_id, conversation_id)
    references public.conversations(organization_id, id) on delete cascade,
  unique (organization_id, conversation_id, client_message_id)
);

alter table public.messages
  add constraint messages_run_fk foreign key (run_id) references public.planning_runs(id);

create unique index one_active_planning_run_per_conversation
  on public.planning_runs (organization_id, conversation_id)
  where status = 'running';

create table public.run_events (
  id bigint generated always as identity primary key,
  organization_id text not null,
  run_id uuid not null references public.planning_runs(id) on delete cascade,
  cursor integer not null check (cursor >= 0),
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (organization_id, run_id, cursor)
);

create table public.packet_snapshots (
  id uuid primary key,
  organization_id text not null,
  conversation_id uuid not null,
  version integer not null check (version > 0),
  content jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id, conversation_id)
    references public.conversations(organization_id, id) on delete cascade,
  unique (organization_id, conversation_id, version),
  unique (organization_id, conversation_id, idempotency_key)
);

create table public.usage_events (
  id uuid primary key,
  organization_id text not null,
  conversation_id uuid not null,
  run_id uuid not null references public.planning_runs(id) on delete cascade,
  evidence_class text not null check (evidence_class in ('synthetic', 'development')),
  provider text not null,
  actual_model text not null,
  actual_service_tier text not null,
  input_tokens integer not null check (input_tokens >= 0),
  cached_input_tokens integer not null check (cached_input_tokens >= 0),
  cache_write_tokens integer not null check (cache_write_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  reasoning_tokens integer not null check (reasoning_tokens >= 0),
  total_tokens integer not null check (total_tokens >= 0),
  price_version text not null,
  cost_microusd bigint not null check (cost_microusd >= 0),
  created_at timestamptz not null default now(),
  foreign key (organization_id, conversation_id)
    references public.conversations(organization_id, id) on delete cascade,
  unique (organization_id, run_id)
);

create table public.agent_session_items (
  id bigint generated always as identity primary key,
  organization_id text not null,
  session_id text not null,
  item jsonb not null,
  created_at timestamptz not null default now()
);

create index conversations_org_updated_idx
  on public.conversations (organization_id, updated_at desc);
create index messages_conversation_idx
  on public.messages (organization_id, conversation_id, created_at, id);
create index run_events_replay_idx
  on public.run_events (organization_id, run_id, cursor);
create index session_items_read_idx
  on public.agent_session_items (organization_id, session_id, id);

insert into public.fixture_organizations (id, name) values
  ('fixture-acme', 'Acme Studio'),
  ('fixture-orbit', 'Orbit Works');

grant usage on schema public to clio_app;
grant select on public.fixture_organizations to clio_app;
grant select, insert, update, delete on
  public.conversations,
  public.messages,
  public.planning_runs,
  public.run_events,
  public.packet_snapshots,
  public.usage_events,
  public.agent_session_items
to clio_app;
grant usage, select on all sequences in schema public to clio_app;

alter table public.fixture_organizations enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.planning_runs enable row level security;
alter table public.run_events enable row level security;
alter table public.packet_snapshots enable row level security;
alter table public.usage_events enable row level security;
alter table public.agent_session_items enable row level security;

create policy fixture_organizations_scope on public.fixture_organizations
  for select to clio_app
  using (id = nullif(current_setting('app.organization_id', true), ''));

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'conversations', 'messages', 'planning_runs', 'run_events',
    'packet_snapshots', 'usage_events', 'agent_session_items'
  ] loop
    execute format(
      'create policy %I on public.%I for all to clio_app using (organization_id = nullif(current_setting(''app.organization_id'', true), '''')) with check (organization_id = nullif(current_setting(''app.organization_id'', true), ''''))',
      relation_name || '_scope',
      relation_name
    );
  end loop;
end $$;
