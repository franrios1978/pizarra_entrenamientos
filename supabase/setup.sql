-- =============================================================================
-- Crew WOD · Configuración de Supabase
-- =============================================================================
-- Este archivo hace tres cosas:
--   1. Guarda una copia de seguridad de los datos que hay ahora en Supabase.
--   2. Sustituye los datos de prueba por el snapshot actual de src/data.js.
--   3. Configura el administrador y las políticas RLS de solo lectura pública.
--
-- Cómo ejecutarlo:
--   1. Crea/confirma el usuario franrios1978@hotmail.com en Authentication > Users.
--   2. Abre Supabase > SQL Editor, pega este archivo completo y pulsa Run.
--   3. Desactiva el registro público en Authentication > Providers > Email.
-- =============================================================================

begin;

-- 1. Copia de seguridad en un esquema no expuesto por la API REST.
create schema if not exists backup;
revoke all on schema backup from public;
revoke all on schema backup from anon, authenticated;

create table if not exists backup.athletes_20261025 as table public.athletes;
create table if not exists backup.workouts_20261025 as table public.workouts;
create table if not exists backup.results_20261025 as table public.results;

-- 2. Sustituir los datos de prueba por el snapshot actual de la web.
delete from public.results;
delete from public.workouts;

insert into public.athletes (id, name) values
  ('tu', 'Fran'),
  ('lucia', 'Lucía'),
  ('fernando', 'Fernando')
on conflict (id) do update set name = excluded.name;

insert into public.workouts (id, date, name, detail, time, scoring, warmup, exercises, note) values
  ('next', '2026-10-26', 'AMRAP 20''', '', '09:00', 'rounds', 'Press Militar ( 4 series de 6 a 8 reps )', '[{"text":"- carrera 300m ( 2 vueltas )"},{"text":"-Thrusters con mancuernas o barra olímpica ( 10 reps )","video":"https://www.youtube.com/watch?v=M5gEwLTtWbg","hint":"Video"},{"text":"- Knee Raises colgado de barra ( 12 reps )","video":"https://www.youtube.com/shorts/0ZtstOTZcHA","hint":"Video"},{"text":"-Flexiones de pecho ( 14 reps )"}]'::jsonb, 'Se puntúa por rondas completas.'),
  ('wod-2026-10-23', '2026-10-23', 'AMRAP 20''', '', '09:00', 'rounds', 'Peso Muerto: 4 series de 5 a 6 rep', '[{"text":"-Carrera 300m (2 vueltas)"},{"text":"-Power Cleans (barra o mancuernas) 8 reps","video":"https://www.youtube.com/watch?v=KwYJTpQ_x5A","hint":"Video"},{"text":"-Kettlebell Swings 12 reps","video":"https://www.youtube.com/watch?v=mKDIuUbH94Q","hint":"Video"},{"text":"-Flexiones de pecho 8 reps"}]'::jsonb, 'Se puntúa por rondas completas.'),
  ('wod-2026-10-22', '2026-10-22', 'AMRAP 20''', '', '09:00', 'rounds', 'Dominadas: 4 series de 6 a 8 rep', '[{"text":"-Devil Press (con mancuernas) 8 reps","video":"https://www.youtube.com/watch?v=ghacPZ9fuFU"},{"text":"-Box Jump Over (Saltos al cajón) 10 rep"},{"text":"-Fondos en Paralelas 8 reps"},{"text":"-Sentadillas aereas con salto 10 reps"},{"text":"-V-Ups 10 reps","video":"https://www.youtube.com/watch?v=7UVgs18Y1P4"}]'::jsonb, 'Se puntúa por rondas completas.'),
  ('wod-2026-10-16', '2026-10-16', 'FOR TIME 20 min''', '', '18:30', 'time', 'Shoulder To Overhead: calent. + 3x5 rep', '["Sentadillas lastradas 20 rep","10 zancadas","300m carrera","x 5 rondas"]'::jsonb, 'Sin descanso (recuperar en carreta)'),
  ('wod-2026-10-19', '2026-10-19', 'AMRAP 20''', '', '20:00', 'rounds', 'Calentamiento', '["Push Press 10 reps","Saltos al cajón 12 reps","Dominadas 8 reps","Lateral Bar-Over Burpee  10 reps"]'::jsonb, 'Descanso máximo de 60 seg')
on conflict (id) do update set
  date = excluded.date,
  name = excluded.name,
  detail = excluded.detail,
  time = excluded.time,
  scoring = excluded.scoring,
  warmup = excluded.warmup,
  exercises = excluded.exercises,
  note = excluded.note;

insert into public.results (id, athlete_id, workout_id, date, value, notes) values
  ('r-mvnkvpgpjwxog', 'tu', 'wod-2026-10-16', '2026-10-16', 870, 'Sentadillas con disco de 15 kg Sentadillas con disco de 15 kg'),
  ('r-mvnkvpgproytg', 'fernando', 'wod-2026-10-16', '2026-10-16', 915, 'Sentadilla con disco de 15 kg'),
  ('r-mvnkvpgpqbkks', 'lucia', 'wod-2026-10-16', '2026-10-16', 870, 'Sentadilla con disco de 5 kg (10 sentadillas) Última ronda 1 vuelta de carreta'),
  ('r-mvnkvpgp1kdsl', 'fernando', 'wod-2026-10-23', '2026-10-23', 4, '4 rondas completas + carrera de la 5ª ronda.'),
  ('r-mvnkvpgploig2', 'tu', 'wod-2026-10-23', '2026-10-23', 5, ''),
  ('r-mvnkvpgpm6w36', 'lucia', 'wod-2026-10-22', '2026-10-22', 4, '4 rondas + 3 ejercicios4 rondas + 3 ejercicios'),
  ('r-mvnkvpgpgfflr', 'tu', 'wod-2026-10-22', '2026-10-22', 4, '4 rondas + 3 ejercicios'),
  ('r-mvnkvpgpz5c8g', 'tu', 'wod-2026-10-19', '2026-10-19', 4, 'Push Press 10 reps + Saltos al cajón 12 reps (de la quinta ronda)'),
  ('r-mvnkvpgpptucx', 'lucia', 'wod-2026-10-19', '2026-10-19', 4, '')
on conflict (id) do update set
  athlete_id = excluded.athlete_id,
  workout_id = excluded.workout_id,
  date = excluded.date,
  value = excluded.value,
  notes = excluded.notes;

-- 3. Perfiles y administrador.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  athlete_id text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists athlete_id text;
alter table public.profiles add column if not exists role text not null default 'member';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from auth.users where lower(email) = lower('franrios1978@hotmail.com')
  ) then
    raise exception 'No existe el usuario % en Authentication > Users. Créalo o confírmalo antes de ejecutar este SQL.', 'franrios1978@hotmail.com';
  end if;
end $$;

insert into public.profiles (id, athlete_id, role)
select id, 'tu', 'admin'
from auth.users
where lower(email) = lower('franrios1978@hotmail.com')
on conflict (id) do update set
  athlete_id = excluded.athlete_id,
  role = 'admin';

-- 4. Función auxiliar y políticas RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'results', 'workouts', 'athletes')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.workouts enable row level security;
alter table public.athletes enable row level security;

-- Perfiles: cada usuario solo puede leer el suyo.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Resultados: lectura pública; escritura solo del administrador.
create policy results_select_public
  on public.results for select
  to anon, authenticated
  using (true);

create policy results_insert_admin
  on public.results for insert
  to authenticated
  with check (public.is_admin());

create policy results_update_admin
  on public.results for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy results_delete_admin
  on public.results for delete
  to authenticated
  using (public.is_admin());

-- Entrenamientos y atletas: lectura pública; escritura solo del administrador.
create policy workouts_select_public
  on public.workouts for select
  to anon, authenticated
  using (true);

create policy workouts_insert_admin
  on public.workouts for insert
  to authenticated
  with check (public.is_admin());

create policy workouts_update_admin
  on public.workouts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy workouts_delete_admin
  on public.workouts for delete
  to authenticated
  using (public.is_admin());

create policy athletes_select_public
  on public.athletes for select
  to anon, authenticated
  using (true);

create policy athletes_insert_admin
  on public.athletes for insert
  to authenticated
  with check (public.is_admin());

create policy athletes_update_admin
  on public.athletes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy athletes_delete_admin
  on public.athletes for delete
  to authenticated
  using (public.is_admin());

-- Permisos de tabla. RLS se encarga de limitar las escrituras al admin.
grant usage on schema public to anon, authenticated;
grant select on public.results, public.workouts, public.athletes to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.results, public.workouts, public.athletes to authenticated;
revoke insert, update, delete on public.results, public.workouts, public.athletes from anon;

commit;

-- Comprobación final (debe devolver 3 atletas, 5 entrenamientos y 9 resultados).
select 'atletas' as tabla, count(*) as total from public.athletes
union all
select 'entrenamientos', count(*) from public.workouts
union all
select 'resultados', count(*) from public.results;
