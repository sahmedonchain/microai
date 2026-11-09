// Emergency kill switch, driven by environment variables so it cannot fail
// because of Redis or any other dependency.
//
//   PAUSE_AI=1         debug-analyze and the wallet summary answer 503 (stops AI spend)
//   PAUSE_VERIFY=1     the Verify endpoint checker answers 503 (stops outbound fetches)
//
// Set the variable in Vercel (Settings > Environment Variables) and redeploy.
// Remove it and redeploy to resume. Every other page keeps working while paused.

export type PauseScope = "ai" | "verify";

const VARS: Record<PauseScope, string> = { ai: "PAUSE_AI", verify: "PAUSE_VERIFY" };

export function isPaused(scope: PauseScope, env: Record<string, string | undefined> = process.env): boolean {
  const v = env[VARS[scope]]?.trim().toLowerCase();
  return v === "1" || v === "true";
}
