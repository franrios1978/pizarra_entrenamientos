-- =============================================================================
-- Crew WOD · PlayList
-- =============================================================================
-- Ejecuta este archivo completo en Supabase > SQL Editor después de setup.sql.
--
-- Crea:
--   1. La tabla public.playlist_entries (entradas del formulario).
--   2. Una función RPC para añadir envíos validados sin permitir escrituras
--      directas a la tabla desde el navegador.
--   3. RLS: lectura pública; modificar/borrar solo el administrador.
--   4. El bucket privado "playlists" y permisos para que solo el administrador
--      pueda leer el archivo playlist.txt.
-- =============================================================================

begin;

-- 1. Tabla de entradas ------------------------------------------------------
create table if not exists public.playlist_entries (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  athlete_id text not null references public.athletes (id) on delete cascade,
  position integer not null check (position between 1 and 50),
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (submission_id, position)
);

create index if not exists playlist_entries_created_idx
  on public.playlist_entries (created_at desc);

-- 2. RPC para crear un envío ------------------------------------------------
-- El navegador no puede insertar filas directamente: solo puede llamar a esta
-- función, que valida el atleta, el número de líneas y la longitud de cada una.
create or replace function public.add_playlist_submission(
  p_athlete_id text,
  p_lines text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_submission_id uuid := gen_random_uuid();
  v_line text;
  v_position integer := 0;
begin
  if p_athlete_id is null
     or not exists (select 1 from public.athletes where id = p_athlete_id) then
    raise exception 'Atleta no válido.' using errcode = '22023';
  end if;

  if p_lines is null or cardinality(p_lines) = 0 then
    raise exception 'Añade al menos un tema.' using errcode = '22023';
  end if;

  if cardinality(p_lines) > 50 then
    raise exception 'No se pueden enviar más de 50 temas.' using errcode = '22023';
  end if;

  foreach v_line in array p_lines loop
    v_line := btrim(v_line);

    if v_line <> '' then
      if char_length(v_line) > 200 then
        raise exception 'Cada tema puede tener como máximo 200 caracteres.'
          using errcode = '22023';
      end if;

      v_position := v_position + 1;

      insert into public.playlist_entries (submission_id, athlete_id, position, text)
      values (v_submission_id, p_athlete_id, v_position, v_line);
    end if;
  end loop;

  if v_position = 0 then
    raise exception 'Añade al menos un tema.' using errcode = '22023';
  end if;

  return v_submission_id;
end;
$$;

revoke all on function public.add_playlist_submission(text, text[]) from public;
grant execute on function public.add_playlist_submission(text, text[]) to anon, authenticated;

-- 3. RLS --------------------------------------------------------------------
alter table public.playlist_entries enable row level security;

drop policy if exists playlist_entries_select_public on public.playlist_entries;
create policy playlist_entries_select_public
  on public.playlist_entries for select
  to anon, authenticated
  using (true);

drop policy if exists playlist_entries_update_admin on public.playlist_entries;
create policy playlist_entries_update_admin
  on public.playlist_entries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists playlist_entries_delete_admin on public.playlist_entries;
create policy playlist_entries_delete_admin
  on public.playlist_entries for delete
  to authenticated
  using (public.is_admin());

-- Sin política de INSERT: las altas pasan siempre por la función anterior.
revoke insert on public.playlist_entries from anon, authenticated;
grant select on public.playlist_entries to anon, authenticated;
grant update, delete on public.playlist_entries to authenticated;

-- 4. Archivo de texto en Storage -------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('playlists', 'playlists', false, 1048576, array['text/plain'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists playlists_select_admin on storage.objects;
create policy playlists_select_admin
  on storage.objects for select
  to authenticated
  using (bucket_id = 'playlists' and public.is_admin());

drop policy if exists playlists_insert_admin on storage.objects;
create policy playlists_insert_admin
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'playlists' and public.is_admin());

drop policy if exists playlists_update_admin on storage.objects;
create policy playlists_update_admin
  on storage.objects for update
  to authenticated
  using (bucket_id = 'playlists' and public.is_admin())
  with check (bucket_id = 'playlists' and public.is_admin());

drop policy if exists playlists_delete_admin on storage.objects;
create policy playlists_delete_admin
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'playlists' and public.is_admin());

commit;
