-- ============================================
-- REPEAT — schema inicial (v0.1, manual logging)
-- ============================================

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  musicbrainz_id text unique,
  created_at timestamptz default now()
);

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references artists(id) on delete cascade,
  title text not null,
  cover_url text,
  release_year int,
  duration_seconds int,
  musicbrainz_id text unique,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists listen_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  play_count int not null default 1,
  logged_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  rating numeric(2,1) check (rating >= 0.5 and rating <= 5.0),
  review_text text,
  created_at timestamptz default now(),
  unique (user_id, album_id)
);

-- Faixas individuais de um álbum
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  musicbrainz_recording_id text,
  title text not null,
  duration_seconds int,
  track_number int,
  disc_number int default 1,
  created_at timestamptz default now(),
  unique (album_id, disc_number, track_number)
);

-- Registro de "essa pessoa já ouviu essa faixa" — existência da linha = ouviu.
-- Desmarcar = apagar a linha.
create table if not exists track_listens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  listened_at timestamptz default now(),
  unique (user_id, track_id)
);

-- View central: soma de segundos ouvidos por usuário, a partir das
-- faixas marcadas individualmente (não mais álbuns inteiros via play_count)
create or replace view user_total_listen_time as
select
  tl.user_id,
  sum(coalesce(t.duration_seconds, 0)) as total_seconds
from track_listens tl
join tracks t on t.id = tl.track_id
group by tl.user_id;

-- ============================================
-- RLS
-- ============================================

alter table artists enable row level security;
alter table albums enable row level security;
alter table profiles enable row level security;
alter table listen_logs enable row level security;
alter table reviews enable row level security;
alter table tracks enable row level security;
alter table track_listens enable row level security;

-- artists / albums: leitura pública, escrita só autenticado
create policy "artists são públicos para leitura"
  on artists for select
  using (true);

create policy "usuários autenticados podem inserir artistas"
  on artists for insert
  to authenticated
  with check (true);

create policy "albums são públicos para leitura"
  on albums for select
  using (true);

create policy "usuários autenticados podem inserir álbuns"
  on albums for insert
  to authenticated
  with check (true);

create policy "usuários autenticados podem atualizar duração de álbuns"
  on albums for update
  to authenticated
  using (true)
  with check (true);

create policy "usuários autenticados podem atualizar duração de álbuns"
  on albums for update
  to authenticated
  using (true)
  with check (true);

-- profiles: leitura pública, edição só do próprio dono
create policy "profiles são públicos para leitura"
  on profiles for select
  using (true);

create policy "usuário edita seu próprio profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "usuário cria seu próprio profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ============================================
-- Trigger: cria profile automaticamente no signup
-- (necessário rodar com security definer pra contornar RLS)
-- ============================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- listen_logs: cada usuário só vê/edita os próprios
create policy "usuário vê seus próprios listen_logs"
  on listen_logs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "usuário insere seus próprios listen_logs"
  on listen_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- reviews: leitura pública (é conteúdo social), escrita só do próprio dono
create policy "reviews são públicas para leitura"
  on reviews for select
  using (true);

create policy "usuário insere suas próprias reviews"
  on reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "usuário edita suas próprias reviews"
  on reviews for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- tracks: leitura pública, escrita só autenticado
create policy "tracks são públicas para leitura"
  on tracks for select
  using (true);

create policy "usuários autenticados podem inserir tracks"
  on tracks for insert
  to authenticated
  with check (true);

-- track_listens: cada usuário só vê/edita os próprios
create policy "usuário vê seus próprios track_listens"
  on track_listens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "usuário insere seus próprios track_listens"
  on track_listens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "usuário remove seus próprios track_listens"
  on track_listens for delete
  to authenticated
  using (auth.uid() = user_id);
