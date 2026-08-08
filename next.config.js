/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "coverartarchive.org",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "lastfm.freetls.fastly.net",
      },
      {
        protocol: "https",
        // A API do Last.fm às vezes devolve URLs de imagem nesse
        // subdomínio (com "-img") em vez de "lastfm.freetls.fastly.net".
        // Sem esse pattern, o next/image bloqueia a imagem mesmo com a
        // cover_url certinha salva no banco.
        hostname: "lastfm-img.freetls.fastly.net",
      },
      {
        protocol: "https",
        hostname: "lastfm.freetls.fmcdn.net",
      },
      {
        protocol: "https",
        // Domínio das capas do Spotify (fallback novo).
        hostname: "i.scdn.co",
      },
    ],
  },
};

module.exports = nextConfig;
