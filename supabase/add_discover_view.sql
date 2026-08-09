-- Roda isso uma vez no SQL Editor do Supabase.
-- "Populares da semana" — mesmo padrão da view trending_albums que já
-- existe (30 dias), só que numa janela de 7 dias. Sem security_invoker
-- de propósito (mesma razão da trending_albums): é agregado público,
-- não expõe quem ouviu, e sem isso cada usuário só veria a própria
-- contribuição por causa da RLS de track_listens.
create or replace view trending_albums_week as
select
  a.id as album_id,
  a.title,
  a.cover_url,
  a.release_year,
  a.genres,
  ar.name as artist_name,
  count(*) as total_plays,
  count(distinct tl.user_id) as distinct_listeners
from track_listens tl
join tracks t on t.id = tl.track_id
join albums a on a.id = t.album_id
join artists ar on ar.id = a.artist_id
where tl.listened_at > now() - interval '7 days'
group by a.id, a.title, a.cover_url, a.release_year, a.genres, ar.name;
