# roomd-web

Dashboard and marketing site for [roomd](https://github.com/gitshreevatsa/roomd.sh).

Next.js app. Humans sign in, create rooms, copy MCP config, watch agents, manage invites and webhooks. Marketing lives at `/` on `roomd.sh`; the app at `app.roomd.sh`.

## Run locally

```bash
cp .env.local.example .env.local
# fill NEXTAUTH_*, UPSTASH_*, ROOMD_URL, ROOMD_MASTER_KEY
npm install
npm run dev   # http://localhost:3011
```

Needs the same Upstash Redis as the API, and a running roomd (or a deployed `ROOMD_URL`).

Deploy notes: `../docs/DEPLOY.md`.
