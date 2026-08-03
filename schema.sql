-- ============================================
-- REPEAT — schema completo (reflete o banco de produção)
-- ============================================

create table if not exists artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  musicbrainz_id text unique,
  source text not null default 'musicbrainz', -- 'musicbrainz' | 'lastfm'
  created_at timestamptz default now()
);

create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references artists(id) on delete cascade,
  title text not null,
  cover_url text,
  release_year int,
  duration_seconds int,
  musicbrainz_id text unique, -- pode ser uma chave sintética "lastfm:album:..." quando source='lastfm'
  genres text[],
  source text not null default 'musicbrainz',
  created_at timestamptz default now()
);

create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  musicbrainz_recording_id text,
  title text not null,
  duration_seconds int,
  track_number int,
  disc_number int default 1,
  source text not null default 'musicbrainz',
  created_at timestamptz default now(),
  unique (album_id, disc_number, track_number)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  lastfm_username text,
  lastfm_last_synced_at timestamptz,
  created_at timestamptz default now()
);

-- Registro de "essa pessoa já ouviu essa faixa" — play_count acumula
-- repetições, listened_at guarda a escuta mais recente.
create table if not exists track_listens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  play_count int not null default 1,
  source text not null default 'manual', -- 'manual' | 'lastfm'
  listened_at timestamptz default now(),
  unique (user_id, track_id)
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

create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  added_at timestamptz default now(),
  unique (user_id, album_id)
);

create table if not exists lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references lists(id) on delete cascade,
  album_id uuid not null references albums(id) on delete cascade,
  added_at timestamptz default now(),
  position int default 0,
  unique (list_id, album_id)
);

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ============================================
-- Views
-- ============================================

-- Tempo total ouvido por usuário (soma duração × repetições de cada faixa).
create or replace view user_total_listen_time as
select
  tl.user_id,
  sum(coalesce(t.duration_seconds, 0) * tl.play_count) as total_seconds
from track_listens tl
join tracks t on t.id = tl.track_id
group by tl.user_id;

alter view user_total_listen_time set (security_invoker = true);

-- "Em alta" — quantas pessoas ouviram cada álbum nos últimos 30 dias.
-- Só expõe números agregados (não expõe quem ouviu), por isso é
-- proposital rodar SEM security_invoker: sem isso, cada usuário só veria
-- a própria contribuição (por causa da RLS de track_listens), e a soma
-- agregada de todo mundo nunca apareceria certa.
create or replace view trending_albums as
select
  a.id as album_id,
  a.title,
  a.cover_url,
  a.musicbrainz_id,
  ar.name as artist_name,
  count(*) as total_plays,
  count(distinct tl.user_id) as distinct_listeners
from track_listens tl
join tracks t on t.id = tl.track_id
join albums a on a.id = t.album_id
join artists ar on ar.id = a.artist_id
where tl.listened_at > now() - interval '30 days'
group by a.id, a.title, a.cover_url, a.musicbrainz_id, ar.name;

-- ============================================
-- Functions (usadas via supabase.rpc(...))
-- ============================================

-- Incrementa (ou cria) o contador de escutas manual de uma faixa.
create or replace function increment_track_listen(p_track_id uuid)
returns track_listens
language plpgsql
security invoker
set search_path = public
as $$
declare
  result track_listens;
begin
  insert into track_listens (user_id, track_id, play_count)
  values (auth.uid(), p_track_id, 1)
  on conflict (user_id, track_id)
  do update set play_count = track_listens.play_count + 1
  returning * into result;
  return result;
end;
$$;

-- Desfaz uma escuta manual (decrementa; some ao chegar a 0).
create or replace function decrement_track_listen(p_track_id uuid)
returns track_listens
language plpgsql
security invoker
set search_path = public
as $$
declare
  result track_listens;
begin
  update track_listens
  set play_count = greatest(play_count - 1, 0)
  where user_id = auth.uid() and track_id = p_track_id
  returning * into result;

  if result.play_count = 0 then
    delete from track_listens where user_id = auth.uid() and track_id = p_track_id;
  end if;

  return result;
end;
$$;

-- Marca o álbum inteiro como ouvido de uma vez (botão rápido na busca).
create or replace function bulk_increment_album(p_album_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into track_listens (user_id, track_id, play_count)
  select auth.uid(), t.id, 1
  from tracks t
  where t.album_id = p_album_id
  on conflict (user_id, track_id)
  do update set play_count = track_listens.play_count + 1;
end;
$$;

-- Incrementa uma escuta com quantidade/data/fonte customizadas — usado
-- pela sincronização do Last.fm (que sabe exatamente quando cada scrobble
-- aconteceu e quantas vezes desde a última sync).
create or replace function sync_track_listen(
  p_track_id uuid,
  p_play_count_delta int,
  p_listened_at timestamptz,
  p_source text default 'manual'
)
returns track_listens
language plpgsql
security invoker
set search_path = public
as $$
declare
  result track_listens;
begin
  insert into track_listens (user_id, track_id, play_count, listened_at, source)
  values (auth.uid(), p_track_id, p_play_count_delta, p_listened_at, p_source)
  on conflict (user_id, track_id)
  do update set
    play_count = track_listens.play_count + p_play_count_delta,
    listened_at = greatest(track_listens.listened_at, excluded.listened_at),
    source = excluded.source
  returning * into result;
  return result;
end;
$$;

grant execute on function increment_track_listen(uuid) to authenticated;
grant execute on function decrement_track_listen(uuid) to authenticated;
grant execute on function bulk_increment_album(uuid) to authenticated;
grant execute on function sync_track_listen(uuid, int, timestamptz, text) to authenticated;

-- Cria profile automaticamente no primeiro login (trigger em auth.users).
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

revoke execute on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- RLS
-- ============================================

alter table artists enable row level security;
alter table albums enable row level security;
alter table tracks enable row level security;
alter table profiles enable row level security;
alter table track_listens enable row level security;
alter table reviews enable row level security;
alter table watchlist enable row level security;
alter table lists enable row level security;
alter table list_items enable row level security;
alter table follows enable row level security;

-- artists / albums / tracks: catálogo público — leitura livre, qualquer
-- usuário logado pode contribuir com dados novos (tipo Letterboxd deixa
-- qualquer um adicionar um filme que falta).
create policy "artists são públicos para leitura" on artists for select using (true);
create policy "usuários autenticados podem inserir artistas" on artists for insert to authenticated with check (true);

create policy "albums são públicos para leitura" on albums for select using (true);
create policy "usuários autenticados podem inserir álbuns" on albums for insert to authenticated with check (true);
create policy "usuários autenticados podem atualizar duração de álbuns" on albums for update to authenticated using (true) with check (true);

create policy "tracks são públicas para leitura" on tracks for select using (true);
create policy "usuários autenticados podem inserir tracks" on tracks for insert to authenticated with check (true);
create policy "usuários autenticados podem atualizar tracks" on tracks for update to authenticated using (true) with check (true);

-- profiles: leitura pública, edição só do próprio dono
create policy "profiles são públicos para leitura" on profiles for select using (true);
create policy "usuário edita seu próprio profile" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "usuário cria seu próprio profile" on profiles for insert to authenticated with check (auth.uid() = id);

-- track_listens: cada usuário vê os próprios OU de quem ele segue (pro
-- carrossel "Amigos ouviram"); só edita/insere/apaga os próprios.
create policy "usuário vê seus próprios track_listens" on track_listens for select to authenticated using (auth.uid() = user_id);
create policy "usuário vê track_listens de quem segue" on track_listens for select to authenticated
  using (exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = track_listens.user_id));
create policy "usuário insere seus próprios track_listens" on track_listens for insert to authenticated with check (auth.uid() = user_id);
create policy "usuário atualiza seus próprios track_listens" on track_listens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuário remove seus próprios track_listens" on track_listens for delete to authenticated using (auth.uid() = user_id);

-- reviews: leitura pública, escrita só do próprio dono
create policy "reviews são públicas para leitura" on reviews for select using (true);
create policy "usuário insere suas próprias reviews" on reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "usuário edita suas próprias reviews" on reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- watchlist: privada, cada usuário só vê/mexe na própria
create policy "usuário vê sua própria watchlist" on watchlist for select to authenticated using (auth.uid() = user_id);
create policy "usuário insere na própria watchlist" on watchlist for insert to authenticated with check (auth.uid() = user_id);
create policy "usuário remove da própria watchlist" on watchlist for delete to authenticated using (auth.uid() = user_id);

-- lists / list_items: públicas por padrão, mas dá pra criar privada
create policy "listas públicas visíveis a todos, privadas só ao dono" on lists for select using (is_public = true or auth.uid() = user_id);
create policy "usuário cria suas próprias listas" on lists for insert to authenticated with check (auth.uid() = user_id);
create policy "usuário edita suas próprias listas" on lists for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "usuário apaga suas próprias listas" on lists for delete to authenticated using (auth.uid() = user_id);

create policy "itens de listas públicas visíveis, privadas só ao dono" on list_items for select
  using (exists (select 1 from lists l where l.id = list_id and (l.is_public = true or l.user_id = auth.uid())));
create policy "dono da lista insere itens" on list_items for insert to authenticated
  with check (exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "dono da lista remove itens" on list_items for delete to authenticated
  using (exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid()));

-- follows: público (é informação social, tipo Instagram)
create policy "follows são públicos para leitura" on follows for select using (true);
create policy "usuário segue alguém" on follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "usuário deixa de seguir alguém" on follows for delete to authenticated using (auth.uid() = follower_id);
