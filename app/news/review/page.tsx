"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Trash2, ExternalLink } from "lucide-react";
import { LogoMark } from "@/app/components/landing/LandingNavbar";
import type { SubmittedPost } from "@/lib/community";

const ADMIN_KEY_STORAGE = "microai_admin_key";

export default function ReviewPage() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [pending, setPending] = useState<SubmittedPost[]>([]);
  const [approved, setApproved] = useState<SubmittedPost[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (() => {
      try {
        const saved = sessionStorage.getItem(ADMIN_KEY_STORAGE);
        if (saved) {
          setKeyInput(saved);
          setAdminKey(saved);
        }
      } catch { /* sessionStorage unavailable */ }
    })();
  }, []);

  const load = async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/community/review", { headers: { "x-admin-key": key } });
      if (!res.ok) {
        setError(res.status === 401 ? "Invalid admin key." : "Failed to load.");
        return;
      }
      const data = await res.json();
      setPending(data.pending ?? []);
      setApproved(data.approved ?? []);
    } catch {
      setError("Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => { if (adminKey) await load(adminKey); })();
  }, [adminKey]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    try { sessionStorage.setItem(ADMIN_KEY_STORAGE, keyInput); } catch { /* ignore */ }
    setAdminKey(keyInput);
  };

  const act = async (action: "approve" | "reject" | "delete", id: string) => {
    try {
      const res = await fetch("/api/community/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) {
        setError("Action failed.");
        return;
      }
      await load(adminKey);
    } catch {
      setError("Action failed.");
    }
  };

  return (
    <div className="min-h-screen bg-space font-sans text-text">
      <header className="sticky top-0 z-50 border-b border-border bg-space/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-sm font-semibold text-text">MicroAI</span>
          </Link>
          <span className="text-sm text-muted">Community review</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {!adminKey ? (
          <form onSubmit={handleUnlock} className="max-w-sm rounded-lg border border-border bg-surface p-5">
            <p className="text-sm font-semibold text-text">Admin key required</p>
            <input
              type="password"
              required
              placeholder="Admin key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="mt-3 w-full rounded-md border border-border bg-space px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none"
            />
            <button type="submit" className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:brightness-110">
              Unlock
            </button>
          </form>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
            )}
            {loading && <p className="text-sm text-muted">Loading...</p>}

            <p className="text-sm font-medium text-text">Pending ({pending.length})</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
              {pending.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Nothing pending.</p>
              ) : (
                pending.map((post) => (
                  <div key={post.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-text hover:underline">
                        {post.title} <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden="true" />
                      </a>
                      <p className="mt-0.5 text-xs text-muted">
                        by {post.creatorName}{post.xHandle ? ` (@${post.xHandle})` : ""}{post.note ? ` · ${post.note}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => act("approve", post.id)} className="rounded-md border border-success/30 bg-success/10 p-1.5 text-success transition hover:bg-success/20" aria-label="Approve">
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                      <button onClick={() => act("reject", post.id)} className="rounded-md border border-danger/30 bg-danger/10 p-1.5 text-danger transition hover:bg-danger/20" aria-label="Reject">
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-8 text-sm font-medium text-text">Approved ({approved.length})</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
              {approved.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">Nothing approved yet.</p>
              ) : (
                approved.map((post) => (
                  <div key={post.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-text hover:underline">
                        {post.title} <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden="true" />
                      </a>
                      <p className="mt-0.5 text-xs text-muted">by {post.creatorName}</p>
                    </div>
                    <button onClick={() => act("delete", post.id)} className="shrink-0 rounded-md border border-danger/30 bg-danger/10 p-1.5 text-danger transition hover:bg-danger/20" aria-label="Delete">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
