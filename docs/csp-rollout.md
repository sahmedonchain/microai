# Content-Security-Policy rollout

Today the policy is sent as `Content-Security-Policy-Report-Only`: nothing is blocked, violations are reported to `/api/csp-report` (they appear in the logs). `CSP_ENFORCE=1` turns it into a blocking policy. **Do not set it in production until every step below passes on a Vercel preview.**

## What the policy allows (reviewed against the code)

| Directive | Value | Why |
| --- | --- | --- |
| script-src | `'self'`, a per-request nonce, `'strict-dynamic'` | No inline script without the nonce |
| connect-src | `'self'` | The browser only calls our own `/api` routes (Stats reads the chain via `/api/chain`); wallets use the injected provider |
| img-src | `'self' data: blob:` | No component renders a remote image. Tests fail if one is added |
| style-src | `'self' 'unsafe-inline'` | The UI uses inline style attributes; inline CSS cannot run script |
| frames, objects, base, forms, framing | none / self / none | Locked down |

## Known risk: the nonce needs dynamic rendering

With `'strict-dynamic'` and a nonce, Next.js can only add the nonce to its own scripts on pages rendered **per request**. Pages that are prerendered at build time have no per-request nonce, so under an enforced policy the browser would block their scripts and the page could fail to load. Only `/verify/r/[id]` is marked `force-dynamic` today. I could not run a production build in the sandbox (it needs Google Fonts), so I have not confirmed which pages are static. Treat this as likely until a preview proves otherwise.

If a preview shows script violations or a blank page with enforcement on, the fix is a separate PR that makes the root layout dynamic (for example by reading `headers()` or setting `export const dynamic = "force-dynamic"`). That costs static optimisation on every page, so decide it deliberately.

## Steps (owner, on a Vercel preview)

1. Deploy the branch as a preview. In that preview's environment set `CSP_ENFORCE=1` (Preview scope only, not Production).
2. Open each page in a fresh browser profile with the console open: Overview, Verify, Payload inspector, Testnet lab, Trust API, Debug, Wallet, Stats, Ecosystem, News, Build status, Terms, Privacy, a shared report `/verify/r/<id>`.
3. Pass means: no `Refused to execute inline script`, no `Refused to connect`, no blocked fonts or images, and every page is interactive (buttons work, tabs switch).
4. Connect a wallet on the preview and switch to Arc (this uses the extension, not the page's network).
5. Check the logs for `csp-report` entries while browsing. Zero is the goal.
6. Only then set `CSP_ENFORCE=1` in Production and redeploy. Keep the previous deployment ready to promote if anything breaks (see incident-response.md).

## Roll back

Remove `CSP_ENFORCE` (or set it to `0`) and redeploy. The header returns to report-only.
