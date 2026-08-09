import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAlbumInfo, getTrackInfo, getArtistGenres } from "@/lib/lastfm";
import { searchAlbumCover } from "@/lib/spotify";

// Rota de manutenção — não roda sozinha, é pra chamar uma vez colando a
// URL no navegador com o secret + o id do usuário dono da lista.
// Cria (ou reaproveita) uma List pública com as 150 músicas mais
// streamadas de todos os tempos no Spotify, criando um "álbum" de 1
// faixa pra cada uma (mesmo padrão usado pro Last.fm em album-helpers.ts)
// e resolvendo a capa via Last.fm → Spotify.
//
// Fonte dos dados: kworb.net/spotify/songs.html (replica os números
// oficiais do Spotify), consultado em agosto/2026. Streams não são
// salvos no banco — só usamos a ordem pra definir a posição na lista.
export const maxDuration = 60;
const TIME_BUDGET_MS = 50_000;

const LIST_TITLE = "110 Músicas Mais Ouvidas de Todos os Tempos";
const LIST_DESCRIPTION =
  "As 110 músicas com mais streams de todos os tempos no Spotify (fonte: kworb.net, dados de agosto/2026).";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// artista + título, em ordem decrescente de streams.
const TOP_110: { artist: string; title: string }[] = [
  { artist: "The Weeknd", title: "Blinding Lights" },
  { artist: "Ed Sheeran", title: "Shape of You" },
  { artist: "The Neighbourhood", title: "Sweater Weather" },
  { artist: "The Weeknd", title: "Starboy" },
  { artist: "Harry Styles", title: "As It Was" },
  { artist: "Lewis Capaldi", title: "Someone You Loved" },
  { artist: "Drake", title: "One Dance" },
  { artist: "Post Malone", title: "Sunflower" },
  { artist: "Ed Sheeran", title: "Perfect" },
  { artist: "The Kid LAROI", title: "STAY" },
  { artist: "Arctic Monkeys", title: "I Wanna Be Yours" },
  { artist: "Imagine Dragons", title: "Believer" },
  { artist: "Coldplay", title: "Yellow" },
  { artist: "Billie Eilish", title: "BIRDS OF A FEATHER" },
  { artist: "Lady Gaga", title: "Die With A Smile" },
  { artist: "Glass Animals", title: "Heat Waves" },
  { artist: "Lord Huron", title: "The Night We Met" },
  { artist: "Billie Eilish", title: "lovely" },
  { artist: "Vance Joy", title: "Riptide" },
  { artist: "The Chainsmokers", title: "Closer" },
  { artist: "The Chainsmokers", title: "Something Just Like This" },
  { artist: "The Police", title: "Every Breath You Take" },
  { artist: "James Arthur", title: "Say You Won't Let Go" },
  { artist: "Tom Odell", title: "Another Love" },
  { artist: "The Goo Goo Dolls", title: "Iris" },
  { artist: "OneRepublic", title: "Counting Stars" },
  { artist: "Hozier", title: "Take Me To Church" },
  { artist: "Ed Sheeran", title: "Photograph" },
  { artist: "Tones And I", title: "Dance Monkey" },
  { artist: "Coldplay", title: "Viva La Vida" },
  { artist: "Macklemore", title: "Can't Hold Us" },
  { artist: "Taylor Swift", title: "Cruel Summer" },
  { artist: "Post Malone", title: "rockstar" },
  { artist: "Bruno Mars", title: "Locked out of Heaven" },
  { artist: "Bruno Mars", title: "Just The Way You Are" },
  { artist: "The Killers", title: "Mr. Brightside" },
  { artist: "Shawn Mendes", title: "Señorita" },
  { artist: "The Weeknd", title: "Die For You" },
  { artist: "Harry Styles", title: "Watermelon Sugar" },
  { artist: "Bruno Mars", title: "That's What I Like" },
  { artist: "Justin Bieber", title: "Love Yourself" },
  { artist: "Linkin Park", title: "In the End" },
  { artist: "Dua Lipa", title: "Don't Start Now" },
  { artist: "Bruno Mars", title: "When I Was Your Man" },
  { artist: "Queen", title: "Bohemian Rhapsody" },
  { artist: "Post Malone", title: "Circles" },
  { artist: "Avicii", title: "Wake Me Up" },
  { artist: "Travis Scott", title: "goosebumps" },
  { artist: "Ed Sheeran", title: "Thinking out Loud" },
  { artist: "Eminem", title: "Without Me" },
  { artist: "Juice WRLD", title: "Lucid Dreams" },
  { artist: "DJ Snake", title: "Let Me Love You" },
  { artist: "John Legend", title: "All Of Me" },
  { artist: "Lady Gaga", title: "Shallow" },
  { artist: "Drake", title: "God's Plan" },
  { artist: "Sabrina Carpenter", title: "Espresso" },
  { artist: "Michael Jackson", title: "Billie Jean" },
  { artist: "Twenty One Pilots", title: "Stressed Out" },
  { artist: "The Weeknd", title: "The Hills" },
  { artist: "Kendrick Lamar", title: "All The Stars" },
  { artist: "Imagine Dragons", title: "Demons" },
  { artist: "Benson Boone", title: "Beautiful Things" },
  { artist: "Imagine Dragons", title: "Thunder" },
  { artist: "Arctic Monkeys", title: "Do I Wanna Know?" },
  { artist: "Tyler, The Creator", title: "See You Again" },
  { artist: "Radiohead", title: "Creep" },
  { artist: "Jung Kook", title: "Seven" },
  { artist: "Justin Bieber", title: "Sorry" },
  { artist: "Shawn Mendes", title: "Treat You Better" },
  { artist: "Nirvana", title: "Smells Like Teen Spirit" },
  { artist: "French Montana", title: "Unforgettable" },
  { artist: "J. Cole", title: "No Role Modelz" },
  { artist: "Eminem", title: "Lose Yourself" },
  { artist: "Oasis", title: "Wonderwall" },
  { artist: "Kendrick Lamar", title: "HUMBLE." },
  { artist: "Arctic Monkeys", title: "505" },
  { artist: "Billie Eilish", title: "bad guy" },
  { artist: "Coldplay", title: "The Scientist" },
  { artist: "Miley Cyrus", title: "Flowers" },
  { artist: "Journey", title: "Don't Stop Believin'" },
  { artist: "Shawn Mendes", title: "There's Nothing Holdin' Me Back" },
  { artist: "Olivia Rodrigo", title: "drivers license" },
  { artist: "Ariana Grande", title: "7 rings" },
  { artist: "Fleetwood Mac", title: "Dreams" },
  { artist: "Passenger", title: "Let Her Go" },
  { artist: "a-ha", title: "Take on Me" },
  { artist: "SZA", title: "Kill Bill" },
  { artist: "Linkin Park", title: "Numb" },
  { artist: "Djo", title: "End of Beginning" },
  { artist: "Guns N' Roses", title: "Sweet Child O' Mine" },
  { artist: "The Weeknd", title: "Save Your Tears" },
  { artist: "Maroon 5", title: "Payphone" },
  { artist: "Elton John", title: "Cold Heart" },
  { artist: "The Weeknd", title: "One Of The Girls" },
  { artist: "Major Lazer", title: "Lean On" },
  { artist: "Calvin Harris", title: "One Kiss" },
  { artist: "Mark Ronson", title: "Uptown Funk" },
  { artist: "Queen", title: "Don't Stop Me Now" },
  { artist: "TOTO", title: "Africa" },
  { artist: "Don Omar", title: "Danza Kuduro" },
  { artist: "Olivia Rodrigo", title: "good 4 u" },
  { artist: "Charlie Puth", title: "We Don't Talk Anymore" },
  { artist: "One Direction", title: "Night Changes" },
  { artist: "J Balvin", title: "LA CANCIÓN" },
  { artist: "Adele", title: "Someone Like You" },
  { artist: "Marshmello", title: "Happier" },
  { artist: "Keane", title: "Somewhere Only We Know" },
  { artist: "Dua Lipa", title: "Levitating" },
  { artist: "Tears For Fears", title: "Everybody Wants To Rule The World" },
  { artist: "Travis Scott", title: "SICKO MODE" },
];

async function resolveSongCover(artist: string, title: string): Promise<string | null> {
  try {
    const lastfmAlbum = await getAlbumInfo(artist, title);
    if (lastfmAlbum?.coverUrl) return lastfmAlbum.coverUrl;
  } catch {
    // segue pro fallback
  }

  try {
    const spotifyCover = await searchAlbumCover(artist, title);
    if (spotifyCover?.coverUrl) return spotifyCover.coverUrl;
  } catch {
    // sem capa mesmo, ok
  }

  return null;
}

async function resolveSongDuration(artist: string, title: string): Promise<number | null> {
  try {
    const trackInfo = await getTrackInfo(artist, title);
    return trackInfo?.durationSeconds ?? null;
  } catch {
    return null;
  }
}

async function resolveSongGenres(artist: string, title: string): Promise<string[]> {
  try {
    const lastfmAlbum = await getAlbumInfo(artist, title);
    if (lastfmAlbum?.genres && lastfmAlbum.genres.length > 0) return lastfmAlbum.genres;
  } catch {
    // segue pro fallback
  }
  try {
    return await getArtistGenres(artist);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "Falta o parâmetro userId (uuid da conta dona da lista)." },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  const supabase = createSupabaseAdminClient();

  // Acha ou cria a lista.
  let { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .eq("name", LIST_TITLE)
    .maybeSingle();

  if (!list) {
    const { data: newList, error: listErr } = await supabase
      .from("lists")
      .insert({
        user_id: userId,
        name: LIST_TITLE,
        description: LIST_DESCRIPTION,
        is_public: true,
      })
      .select("id")
      .single();

    if (listErr || !newList) {
      return NextResponse.json(
        { error: "Não consegui criar a lista.", details: listErr?.message },
        { status: 500 }
      );
    }
    list = newList;
  }

  let processed = 0;
  let added = 0;
  let alreadyInList = 0;
  let failed = 0;
  let timedOut = false;
  const failedSongs: string[] = [];

  for (let i = 0; i < TOP_110.length; i++) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }

    const { artist, title } = TOP_110[i];
    processed++;

    const artistKey = `lastfm:artist:${slugify(artist)}`;
    const albumKey = `lastfm:album:${slugify(artist)}:${slugify(title)}`;

    // Já existe esse "álbum" (música)? Reaproveita em vez de gerar de novo.
    let { data: existingAlbum } = await supabase
      .from("albums")
      .select("id")
      .eq("musicbrainz_id", albumKey)
      .maybeSingle();

    let albumId = existingAlbum?.id;

    if (!albumId) {
      const [coverUrl, durationSeconds, genres] = await Promise.all([
        resolveSongCover(artist, title),
        resolveSongDuration(artist, title),
        resolveSongGenres(artist, title),
      ]);

      let { data: artistRow } = await supabase
        .from("artists")
        .select("id")
        .eq("musicbrainz_id", artistKey)
        .maybeSingle();

      if (!artistRow) {
        const { data: newArtist, error: artistErr } = await supabase
          .from("artists")
          .insert({ name: artist, musicbrainz_id: artistKey, source: "lastfm" })
          .select("id")
          .single();
        if (artistErr || !newArtist) {
          failed++;
          failedSongs.push(`${artist} - ${title} (artista: ${artistErr?.message})`);
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        artistRow = newArtist;
      }

      const { data: newAlbum, error: albumErr } = await supabase
        .from("albums")
        .insert({
          artist_id: artistRow.id,
          title,
          cover_url: coverUrl,
          musicbrainz_id: albumKey,
          source: "lastfm",
          duration_seconds: durationSeconds,
          genres: genres.length > 0 ? genres : null,
        })
        .select("id")
        .single();

      if (albumErr || !newAlbum) {
        failed++;
        failedSongs.push(`${artist} - ${title} (álbum: ${albumErr?.message})`);
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      albumId = newAlbum.id;

      await supabase.from("tracks").upsert(
        {
          album_id: albumId,
          musicbrainz_recording_id: `lastfm:track:${albumKey}:1`,
          title,
          duration_seconds: durationSeconds,
          track_number: 1,
          disc_number: 1,
          source: "lastfm",
        },
        { onConflict: "album_id,disc_number,track_number" }
      );
    }

    // Adiciona na lista, se ainda não estiver.
    const { data: existingItem } = await supabase
      .from("list_items")
      .select("id")
      .eq("list_id", list.id)
      .eq("album_id", albumId)
      .maybeSingle();

    if (existingItem) {
      alreadyInList++;
    } else {
      const { error: itemErr } = await supabase.from("list_items").insert({
        list_id: list.id,
        album_id: albumId,
        position: i,
      });
      if (itemErr) {
        failed++;
        failedSongs.push(`${artist} - ${title} (list_item: ${itemErr.message})`);
      } else {
        added++;
      }
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  return NextResponse.json({
    listId: list.id,
    totalSongs: TOP_110.length,
    processed,
    added,
    alreadyInList,
    failed,
    failedSongs,
    timedOut,
    note: timedOut
      ? "Time budget estourado — chama essa rota de novo (mesma URL) pra continuar de onde parou."
      : "Concluído.",
  });
}
