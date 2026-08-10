// Lista de permissão (não de bloqueio) — o Last.fm usa tags livres
// (qualquer usuário aplica qualquer coisa: nome de artista, "5 stars",
// "my top songs", país, década...), então tentar bloquear o que não é
// gênero é um jogo de gato e rato que a gente sempre perde. Em vez
// disso, só aceitamos o que já está mapeado aqui — e tudo mapeia pra um
// nome canônico, pra "Hip-Hop", "hip hop" e "hiphop" virarem uma coisa só.
//
// Chave = variação normalizada (lowercase, sem espaço/hífen extra) que
// pode aparecer na tag recebida. Valor = nome de exibição canônico.
const GENRE_ALIASES: Record<string, string> = {
  // Pop
  pop: "Pop", "pop rock": "Pop Rock", poprock: "Pop Rock",
  "pop rap": "Pop Rap", poprap: "Pop Rap",
  "synth pop": "Synth-Pop", synthpop: "Synth-Pop", "synth-pop": "Synth-Pop",
  britpop: "Britpop", "k-pop": "K-Pop", kpop: "K-Pop", "j-pop": "J-Pop", jpop: "J-Pop",
  "dance pop": "Dance-Pop", "dance-pop": "Dance-Pop", dancepop: "Dance-Pop",
  "indie pop": "Indie Pop", indiepop: "Indie Pop",
  "psychedelic pop": "Psychedelic Pop",

  // Rock
  rock: "Rock", "classic rock": "Classic Rock", "indie rock": "Indie Rock",
  indierock: "Indie Rock", "alternative rock": "Alternative Rock",
  altrock: "Alternative Rock", "acoustic rock": "Acoustic Rock",
  "psychedelic rock": "Psychedelic Rock", "gothic rock": "Gothic Rock",
  "punk rock": "Punk Rock", punk: "Punk", "pop punk": "Pop Punk",
  "j-rock": "J-Rock", jrock: "J-Rock", grunge: "Grunge",

  // Alternative / indie geral
  alternative: "Alternative", indie: "Indie", indietronica: "Indietronica",

  // Metal
  metal: "Metal", "alternative metal": "Alternative Metal",
  "industrial metal": "Industrial Metal", "nu metal": "Nu Metal", numetal: "Nu Metal",
  "heavy metal": "Heavy Metal", industrial: "Industrial",

  // Hip-hop / rap
  "hip hop": "Hip-Hop", "hip-hop": "Hip-Hop", hiphop: "Hip-Hop",
  rap: "Rap", "cloud rap": "Cloud Rap", trap: "Trap",

  // R&B / soul / funk (US)
  "r&b": "R&B", rnb: "R&B", "contemporary r&b": "Contemporary R&B",
  soul: "Soul", funk: "Funk",

  // Eletrônica
  electronic: "Electronic", electronica: "Electronic", edm: "EDM",
  house: "House", "deep house": "Deep House", techno: "Techno",
  dubstep: "Dubstep", disco: "Disco", ambient: "Ambient", chillout: "Chillout",
  "lo-fi": "Lo-Fi", lofi: "Lo-Fi", "minor key tonality": "Minor Key",

  // Folk / country / acústico
  folk: "Folk", country: "Country", forro: "Forró", "forró": "Forró",

  // Latino / brasileiro
  latin: "Latin", "latin pop": "Latin Pop", salsa: "Salsa", reggaeton: "Reggaeton",
  reggae: "Reggae", sertanejo: "Sertanejo",
  "sertanejo universitario": "Sertanejo Universitário",
  "sertanejo universitário": "Sertanejo Universitário",
  sierreno: "Sierreño", "sierreño": "Sierreño",
  brazil: "Música Brasileira", brazilian: "Música Brasileira",
  "brazilian music": "Música Brasileira", "musica brasileira": "Música Brasileira",
  "música brasileira": "Música Brasileira", piseiro: "Piseiro",
  "funk mandelao": "Funk Mandelão", "funk mandelão": "Funk Mandelão",
  gostoso: "Funk Mandelão", // gíria que aparece quase só em tag de funk mandelão

  // Hardcore / screamo
  screamo: "Screamo", hardcore: "Hardcore", "melodic hardcore": "Melodic Hardcore",
  emo: "Emo", ska: "Ska",

  // Jazz / clássico / erudito
  jazz: "Jazz", blues: "Blues", classical: "Clássica", opera: "Ópera",
  orchestral: "Orquestral", symphonic: "Sinfônico",

  // Mais brasileiro
  mpb: "MPB", samba: "Samba", pagode: "Pagode", "bossa nova": "Bossa Nova",
  bossanova: "Bossa Nova", axe: "Axé", "axé": "Axé", frevo: "Frevo",

  // Outros latinos
  bachata: "Bachata", merengue: "Merengue", cumbia: "Cumbia",
  vallenato: "Vallenato", flamenco: "Flamenco", tango: "Tango",

  // Mundo / raízes
  afrobeat: "Afrobeat", afrobeats: "Afrobeats", gospel: "Gospel",
  christian: "Cristã", world: "World Music",

  // Outros gêneros de nicho comuns no MusicBrainz/Last.fm
  "new wave": "New Wave", "post-punk": "Post-Punk", postpunk: "Post-Punk",
  shoegaze: "Shoegaze", "trip hop": "Trip Hop", triphop: "Trip Hop",
  "drum and bass": "Drum and Bass", dnb: "Drum and Bass",
  vaporwave: "Vaporwave", downtempo: "Downtempo",

  // Outros
  soundtrack: "Soundtrack", mashup: "Mashup", cover: "Cover",
};

// Décadas ("60s", "70s", "2010s"...) não são gênero — filtra fora.
const DECADE_RE = /^\d{2,4}s$/;

function normalizeKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

// Recebe uma lista de tags cruas (Last.fm) ou nomes de gênero
// (MusicBrainz) e devolve só o que reconhecemos como gênero de
// verdade, com nome padronizado e sem duplicata — no máximo 3.
export function normalizeGenres(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    const key = normalizeKey(raw);
    if (!key || DECADE_RE.test(key)) continue;

    const canonical = GENRE_ALIASES[key];
    if (!canonical) continue;

    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
    if (result.length >= 3) break;
  }

  return result;
}
