// Emergency kill switch, driven by environment variables so it cannot fail
// because of Redis or any other dependency.
//
//   PAUSE_AI=1         chat, copilot and debug-analyze answer 503 (stops AI spend)
//   PAUSE_PURCHASES=1  credit purchases answer 503 (stops taking new payments)
//
// Set the variable in Vercel (Settings > Environment Variables) and redeploy.
// Remove it and redeploy to resume. Reading balances, recovering an earlier
// payment's status and every other page keep working while paused.

export type PauseScope = "ai" | "purchases";

const VARS: Record<PauseScope, string> = { ai: "PAUSE_AI", purchases: "PAUSE_PURCHASES" };

export function isPaused(scope: PauseScope, env: Record<string, string | undefined> = process.env): boolean {
  const v = env[VARS[scope]]?.trim().toLowerCase();
  return v === "1" || v === "true";
}
