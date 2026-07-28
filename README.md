# Repeat

"Quanto tempo da sua vida você já gastou ouvindo música?"

MVP v0.1 — logging manual de álbuns ouvidos, sem depender de API do Spotify/Apple Music.
Dados de álbum vêm da MusicBrainz (gratuita, sem chave, só exige User-Agent).

## Stack

- Next.js 15 (App Router) + React 19
- Supabase (Postgres + Auth)
- Tailwind CSS
- MusicBrainz API (busca de álbuns/artistas) + Cover Art Archive (capas)

## Setup local

1. Instalar dependências:

   ```bash
   npm install
   ```

2. Criar um projeto no [supabase.com](https://supabase.com) (pode ser um projeto novo, separado do Garfado).

3. No SQL Editor do Supabase, rodar o conteúdo de `schema.sql`.

4. Copiar `.env.local.example` para `.env.local` e preencher com a URL e a anon key do seu projeto Supabase (Settings → API).

5. Configurar autenticação (Google OAuth, igual ao Garfado) em Authentication → Providers, se quiser login social. Pra v0.1 rodando local, o login por e-mail/senha do próprio Supabase Auth já funciona sem configuração extra — só falta criar a UI de login (ainda não incluída neste scaffold).

6. Rodar:

   ```bash
   npm run dev
   ```

7. Abrir `http://localhost:3000`.

## O que já existe

- `/` — busca de álbuns (MusicBrainz) + botão "Já ouvi" que salva no banco
- `/profile` — mostra o total de horas ouvidas (via view `user_total_listen_time`) e os últimos álbuns marcados
- `POST /api/log-listen` — registra um álbum como ouvido; na primeira vez que um álbum é marcado por qualquer usuário, busca a duração real na MusicBrainz e guarda em cache no banco (não busca de novo depois)
- `GET /api/search-albums?q=` — proxy de busca pra MusicBrainz

## O que falta pra próxima sessão

- [ ] Tela/fluxo de login (pode copiar o padrão de Google OAuth do Garfado)
- [ ] Middleware de sessão (renovar cookie do Supabase Auth em cada request — necessário pro `/profile` funcionar em produção)
- [ ] Reviews (nota + texto) — schema já existe, falta UI
- [ ] Perfil público de outros usuários (`/[username]`, mesmo padrão de rota do Garfado)
- [ ] Deploy na Vercel + domínio (repeat.com.br ou variante, ver disponibilidade)

## Nota sobre a MusicBrainz API

Rate limit é 1 requisição/segundo por IP sem chave. Suficiente pro MVP.
Documentação: https://musicbrainz.org/doc/MusicBrainz_API
