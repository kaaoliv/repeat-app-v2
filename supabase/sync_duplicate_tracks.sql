-- Roda isso uma vez no SQL Editor do Supabase.
--
-- Problema: quando a mesma música aparece em mais de um álbum no nosso
-- banco (ex: single + álbum, ou o mesmo álbum criado duas vezes por
-- fontes diferentes — MusicBrainz numa sync antiga, Last.fm numa nova),
-- cada aparição vira uma linha separada em `tracks`. Marcar como ouvida
-- numa delas não refletia na outra, porque track_listens é por
-- track_id, não por música de verdade.
--
-- Fix: depois de marcar uma faixa, propaga a MESMA contagem pras faixas
-- "irmãs" — outras linhas em `tracks` com o mesmo musicbrainz_recording_id
-- (mesma gravação de verdade, MBID de recording é estável entre
-- releases). Não propaga faixas sem recording_id (conteúdo do Last.fm
-- puro, que não tem MBID de gravação — aí não tem como saber com certeza
-- que é a mesma música).

create or replace function increment_track_listen(p_track_id uuid)
returns track_listens
language plpgsql
security invoker
set search_path = public
as $$
declare
  result track_listens;
  v_recording_id text;
begin
  insert into track_listens (user_id, track_id, play_count)
  values (auth.uid(), p_track_id, 1)
  on conflict (user_id, track_id)
  do update set play_count = track_listens.play_count + 1
  returning * into result;

  select musicbrainz_recording_id into v_recording_id from tracks where id = p_track_id;

  if v_recording_id is not null then
    insert into track_listens (user_id, track_id, play_count)
    select auth.uid(), t2.id, result.play_count
    from tracks t2
    where t2.musicbrainz_recording_id = v_recording_id
      and t2.id <> p_track_id
    on conflict (user_id, track_id)
    do update set play_count = result.play_count;
  end if;

  return result;
end;
$$;

create or replace function decrement_track_listen(p_track_id uuid)
returns track_listens
language plpgsql
security invoker
set search_path = public
as $$
declare
  result track_listens;
  v_recording_id text;
  v_new_count int;
begin
  update track_listens
  set play_count = greatest(play_count - 1, 0)
  where user_id = auth.uid() and track_id = p_track_id
  returning * into result;

  v_new_count := coalesce(result.play_count, 0);

  if result.play_count = 0 then
    delete from track_listens where user_id = auth.uid() and track_id = p_track_id;
  end if;

  select musicbrainz_recording_id into v_recording_id from tracks where id = p_track_id;

  if v_recording_id is not null then
    if v_new_count = 0 then
      delete from track_listens
      where user_id = auth.uid()
        and track_id in (
          select id from tracks
          where musicbrainz_recording_id = v_recording_id and id <> p_track_id
        );
    else
      insert into track_listens (user_id, track_id, play_count)
      select auth.uid(), t2.id, v_new_count
      from tracks t2
      where t2.musicbrainz_recording_id = v_recording_id and t2.id <> p_track_id
      on conflict (user_id, track_id)
      do update set play_count = v_new_count;
    end if;
  end if;

  return result;
end;
$$;

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

  -- Propaga pras faixas irmãs (mesma gravação em outros álbuns).
  insert into track_listens (user_id, track_id, play_count)
  select auth.uid(), t2.id, tl.play_count
  from tracks t1
  join track_listens tl on tl.track_id = t1.id and tl.user_id = auth.uid()
  join tracks t2 on t2.musicbrainz_recording_id = t1.musicbrainz_recording_id
    and t2.id <> t1.id
  where t1.album_id = p_album_id
    and t1.musicbrainz_recording_id is not null
  on conflict (user_id, track_id)
  do update set play_count = excluded.play_count;
end;
$$;
