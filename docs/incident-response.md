# Incident response and monitoring

MicroAI is live on Arc Mainnet, early preview, not independently audited. This page is the plan for when something goes wrong. Nothing here is automatic: the monitors and alerts below must be set up by the owner in their own accounts.

## What to watch

| Signal | How | Alert when |
| --- | --- | --- |
| App and dependencies up | An uptime monitor (any service) calls `GET https://microai-tan.vercel.app/api/health` every minute | Any response other than 200. A 503 body names which dependency is down: `redis` or `arcRpc` |
| Server errors | Vercel logs are JSON lines: `{"ts","level","msg",...}`. Search for `"level":"error"` | More than a handful in 5 minutes |
| Limiter failing closed | Log line `redis limiter unavailable, failing closed` | Any occurrence: Redis is down and several routes answer 503 |
| Kill switch active | Routes answer 503 `paused` | You set it, so confirm it is intended |
| Payment wallet | Watch `0x78C144A76614A8674285129810555C8bCa78f044` on the Arc explorer (it still holds funds from retired credits) | Any outgoing transfer you did not make |

The health endpoint is cached 15 seconds per server instance and rate limited, so a monitor cannot load the RPC.

## First 10 minutes

1. **Decide the size.** Wrong results shown to users, funds at risk, or a leaked secret: treat as serious. A dependency being down with correct 503s: minor.
2. **Stop the harm first.**
   - Set `PAUSE_VERIFY=1` to stop outbound endpoint checks and the Trust API.
   - Set `PAUSE_AI=1` to stop Debug analysis and the wallet summary (AI spend).
   - In Vercel: Settings, Environment Variables, add the variable, redeploy. Remove and redeploy to resume.
3. **Roll back a bad release.** In Vercel Deployments, promote the last known good deployment.
4. **Write down** what you saw, when, and what you changed. Do not delete logs.

## Leaked or suspected secret

| Secret | Action |
| --- | --- |
| `SESSION_SECRET` | Replace with a new long random value and redeploy. Every sign-in session ends |
| `GROQ_API_KEY` | Revoke in the Groq console, create a new key, update Vercel, redeploy |
| `UPSTASH_REDIS_REST_TOKEN` | Rotate in Upstash, update Vercel, redeploy |
| `GITHUB_TOKEN` | Revoke on GitHub, create a new one with no extra scopes, update, redeploy |
| Payment wallet key | Move remaining funds to a new wallet you control, then update `PAYMENT_RECEIVER` in `lib/arcConfig.ts` through a reviewed PR |

MicroAI never asks for or stores users' private keys or seed phrases. If a report says otherwise, treat it as serious.

## Vulnerability reports

Reports arrive through GitHub private vulnerability reporting (see SECURITY.md). Acknowledge, reproduce on a preview, fix in a private branch if needed, then release. Do not publish an unfixed vulnerability.

## Telling users

- Say what happened, what is affected, what you did and what users should do. No guesses, no "100% secure" claims.
- Post the same short notice on X and Discord, and on the status or README banner if it lasts.
- If users could have lost money, say so plainly and point to the refund process in the Terms.

## After

Write a short post-mortem within 3 days: timeline, cause, what worked, what to change. Turn each change into its own PR with a test.

## Not covered yet

Paging a person at night, a second on-call, automated backups of Redis data, and a tested restore. These need decisions and accounts outside this repository.
