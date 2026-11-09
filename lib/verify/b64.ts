// base64 / base64url to text without Node's Buffer, so it also runs in the browser.
export function b64ToUtf8(value: string): string {
  const bin = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
