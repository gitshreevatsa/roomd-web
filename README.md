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

## Invite redeem flow

Operator and teammate invites never email the long-lived API key. Instead:

1. Prepare/invite mints a key and stores a one-hour Redis token at `app:redeem:{token}`.
2. The email contains only `/redeem/{token}` (also available as `GET /api/redeem/{token}`).
3. Opening the link returns the secret **once**, then deletes the token.
4. Owner UI `prepare` may still return `secret` + `redeemUrl` for clipboard copy.

Deploy notes: `../docs/DEPLOY.md`.
