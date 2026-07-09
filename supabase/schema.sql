-- ============================================================================
--  TidyUp — Esquema de base de datos (Supabase / Postgres)
--  Pégalo entero en el SQL Editor de Supabase y ejecútalo una vez.
--  Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

-- Embeddings para la búsqueda semántica (RAG).
create extension if not exists vector;

-- ----------------------------------------------------------------------------
--  TABLAS
-- ----------------------------------------------------------------------------

-- Un HOGAR es el espacio compartido (p. ej. "Casa"). Tú y tu pareja pertenecéis
-- al mismo hogar y veis los mismos objetos.
create table if not exists hogares (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null default 'Mi hogar',
  codigo_invitacion text not null unique default upper(substr(md5(random()::text), 1, 6)),
  creado            timestamptz not null default now()
);

-- Qué usuarios pertenecen a qué hogar.
create table if not exists miembros (
  hogar_id uuid not null references hogares(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  creado   timestamptz not null default now(),
  primary key (hogar_id, user_id)
);

-- Los OBJETOS guardados. La ubicación se descompone en:
--   habitacion  -> dónde (dormitorio, cocina, trastero…)
--   almacenaje  -> mueble/contenedor (cómoda, armario, estantería…)
--   ubicacion   -> sitio dentro del almacenaje (segundo cajón, balda de arriba…)
create table if not exists items (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references hogares(id) on delete cascade,
  nombre      text not null,
  habitacion  text not null default '',
  almacenaje  text not null default '',
  ubicacion   text not null default '',
  categoria   text not null default '',
  etiquetas   text[] not null default '{}',
  notas       text not null default '',
  foto_path   text,                 -- ruta en el bucket 'fotos' (no la imagen en sí)
  embedding   vector(768),          -- text-embedding-004 => 768 dimensiones
  creado_por  uuid references auth.users(id),
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create index if not exists items_hogar_idx on items(hogar_id);
-- Índice para búsqueda vectorial por coseno (HNSW no necesita entrenamiento previo).
create index if not exists items_embedding_idx
  on items using hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
--  HELPER: ¿el usuario actual es miembro de este hogar?
--  SECURITY DEFINER para poder consultarse dentro de las políticas RLS.
-- ----------------------------------------------------------------------------
create or replace function es_miembro(h uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from miembros m
    where m.hogar_id = h and m.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
--  RLS (Row Level Security): cada uno solo ve/edita lo de SU hogar.
-- ----------------------------------------------------------------------------
alter table hogares  enable row level security;
alter table miembros enable row level security;
alter table items    enable row level security;

drop policy if exists hogares_select on hogares;
create policy hogares_select on hogares for select using (es_miembro(id));

drop policy if exists miembros_select on miembros;
create policy miembros_select on miembros for select using (user_id = auth.uid());

drop policy if exists items_select on items;
create policy items_select on items for select using (es_miembro(hogar_id));

drop policy if exists items_insert on items;
create policy items_insert on items for insert with check (es_miembro(hogar_id));

drop policy if exists items_update on items;
create policy items_update on items for update using (es_miembro(hogar_id)) with check (es_miembro(hogar_id));

drop policy if exists items_delete on items;
create policy items_delete on items for delete using (es_miembro(hogar_id));

-- ----------------------------------------------------------------------------
--  RPC: crear / unirse a un hogar (SECURITY DEFINER para saltar RLS de forma
--  controlada; por eso están acotadas a auth.uid()).
-- ----------------------------------------------------------------------------
create or replace function crear_hogar(nombre text default 'Mi hogar')
returns hogares
language plpgsql
security definer
set search_path = public
as $$
declare h hogares;
begin
  insert into hogares(nombre) values (coalesce(nullif(trim(nombre), ''), 'Mi hogar'))
    returning * into h;
  insert into miembros(hogar_id, user_id) values (h.id, auth.uid());
  return h;
end;
$$;

create or replace function unirse_a_hogar(codigo text)
returns hogares
language plpgsql
security definer
set search_path = public
as $$
declare h hogares;
begin
  select * into h from hogares where codigo_invitacion = upper(trim(codigo));
  if h.id is null then
    raise exception 'Código de invitación no válido';
  end if;
  insert into miembros(hogar_id, user_id) values (h.id, auth.uid())
    on conflict do nothing;
  return h;
end;
$$;

-- ----------------------------------------------------------------------------
--  RPC: búsqueda RAG por similitud coseno dentro de un hogar.
--  (SECURITY INVOKER por defecto -> respeta RLS.)
-- ----------------------------------------------------------------------------
create or replace function buscar_items(
  query_embedding vector(768),
  h uuid,
  limite int default 20
)
returns table (
  id uuid, nombre text, habitacion text, almacenaje text, ubicacion text,
  categoria text, etiquetas text[], notas text, foto_path text,
  creado timestamptz, actualizado timestamptz, score float
)
language sql
stable
as $$
  select i.id, i.nombre, i.habitacion, i.almacenaje, i.ubicacion,
         i.categoria, i.etiquetas, i.notas, i.foto_path,
         i.creado, i.actualizado,
         1 - (i.embedding <=> query_embedding) as score
  from items i
  where i.hogar_id = h and i.embedding is not null
  order by i.embedding <=> query_embedding
  limit limite;
$$;

-- ----------------------------------------------------------------------------
--  RATE LIMITING de la IA: cuenta llamadas por usuario y día (anti-abuso).
--  La función valida la sesión (auth.uid()) Y limita en una sola llamada.
-- ----------------------------------------------------------------------------
create table if not exists ia_uso (
  user_id  uuid not null references auth.users(id) on delete cascade,
  dia      date not null default current_date,
  contador int  not null default 0,
  primary key (user_id, dia)
);
alter table ia_uso enable row level security; -- solo la accede la función SECURITY DEFINER

-- Suma 1 al uso del día del usuario actual y devuelve TRUE si sigue por debajo
-- del límite. Si no hay sesión, lanza excepción (la función serverless -> 401).
create or replace function consumir_cuota_ia(limite int default 150)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  actual int;
begin
  if uid is null then
    raise exception 'no autenticado';
  end if;
  insert into ia_uso(user_id, dia, contador) values (uid, current_date, 1)
    on conflict (user_id, dia) do update set contador = ia_uso.contador + 1
    returning contador into actual;
  return actual <= limite;
end;
$$;

-- ----------------------------------------------------------------------------
--  STORAGE: bucket PRIVADO para las fotos. Ruta = <hogar_id>/<item_id>.jpg
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists fotos_select on storage.objects;
create policy fotos_select on storage.objects for select
  using (bucket_id = 'fotos' and es_miembro(((storage.foldername(name))[1])::uuid));

drop policy if exists fotos_insert on storage.objects;
create policy fotos_insert on storage.objects for insert
  with check (bucket_id = 'fotos' and es_miembro(((storage.foldername(name))[1])::uuid));

drop policy if exists fotos_update on storage.objects;
create policy fotos_update on storage.objects for update
  using (bucket_id = 'fotos' and es_miembro(((storage.foldername(name))[1])::uuid));

drop policy if exists fotos_delete on storage.objects;
create policy fotos_delete on storage.objects for delete
  using (bucket_id = 'fotos' and es_miembro(((storage.foldername(name))[1])::uuid));
