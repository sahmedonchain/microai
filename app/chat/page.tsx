"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { WalletModal } from "@/app/components/WalletModal";

const ARC_CHAIN_ID = "0x13b2";
const USDC_CONTRACT = "0x3600000000000000000000000000000000000000";
const RECEIVER_ADDRESS = "0x9a318CD2BC533B5B2e96F7f5b499738732492b15";
const PRICE_PER_QUERY = 1000; // 0.001 USDC, 6-decimal units — display only, server enforces the real charge
const STORAGE_KEY = "microai_chat_history";
const EXPLORER = "https://explorer.arc.io/tx/";
const TRANSFER_ABI = "0xa9059cbb"; // transfer(address,uint256)

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  txHash?: string;
}

const SUGGESTIONS = [
  { title: "What is Arc Blockchain?", desc: "L1 stablecoin commerce chain" },
  { title: "How does Circle USDC work?", desc: "Cross-chain transfers & APIs" },
  { title: "Deploy on Arc MAINNET", desc: "Step-by-step contract guide" },
  { title: "ERC-8004 AI Agents", desc: "Register your AI agent on Arc" },
];

// Polls for the transaction receipt via the wallet's own provider so we only
// send the txHash to the server once it's actually mined.
async function waitForReceipt(
  provider: EthereumProvider,
  txHash: string,
  timeoutMs = 20000,
  intervalMs = 1000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = (await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      })) as { status?: string } | null;
      if (receipt) return receipt.status === "0x1";
    } catch {
      // transient RPC hiccup — keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [txStep, setTxStep] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showNetMenu, setShowNetMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const netMenuRef = useRef<HTMLDivElement>(null);

  // Load chat history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* silent */ }
  }, []);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* silent */ }
    }
  }, [messages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (netMenuRef.current && !netMenuRef.current.contains(e.target as Node)) setShowNetMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 35; i++) {
      particles.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, size: Math.random() * 1.2 + 0.4, opacity: Math.random() * 0.15 + 0.04 });
    }
    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16,185,129,${p.opacity})`; ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  const getBalance = useCallback(async (address: string, prov: EthereumProvider) => {
    try {
      const data = "0x70a08231" + address.slice(2).padStart(64, "0");
      const result = await prov.request({ method: "eth_call", params: [{ to: USDC_CONTRACT, data }, "latest"] }) as string;
      setBalance((parseInt(result, 16) / 1e6).toFixed(3));
    } catch { /* silent */ }
  }, []);

  const handleWalletConnect = useCallback(async (address: string, connectedProvider: EthereumProvider) => {
    setWallet(address);
    setProvider(connectedProvider);
    setShowWalletModal(false);
    await getBalance(address, connectedProvider);
  }, [getBalance]);

  const disconnect = () => {
    setWallet(null); setBalance(null); setProvider(null); setTxStep("");
  };

  const clearHistory = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
  };

  const copyLastAnswer = async () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading || !wallet || !provider) return;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      setTxStep("Confirm $0.001 USDC payment in MetaMask...");

      const chainId = await provider.request({ method: "eth_chainId" }) as string;
      if (chainId !== ARC_CHAIN_ID) {
        await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] });
      }

      // Direct USDC transfer: user wallet -> RECEIVER_ADDRESS, exactly 0.001 USDC.
      const amountHex = PRICE_PER_QUERY.toString(16).padStart(64, "0");
      const recipientHex = RECEIVER_ADDRESS.slice(2).padStart(64, "0");
      const transferData = TRANSFER_ABI + recipientHex + amountHex;

      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: wallet, to: USDC_CONTRACT, data: transferData, gas: "0x186A0" }],
      }) as string;

      setTxStep("Confirming transaction...");
      const mined = await waitForReceipt(provider, txHash);
      if (!mined) throw new Error("Transaction did not confirm in time. Please try again.");

      setTxStep("Generating response...");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.text })),
          txHash,
          walletAddress: wallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      setMessages(prev => [...prev, { role: "assistant", text: data.reply || "Could not generate a response.", txHash: data.txHash || txHash }]);
      await getBalance(wallet, provider);

    } catch (err: unknown) {
      const error = err as { code?: number; message?: string };
      if (error?.code === 4001) {
        setMessages(prev => [...prev, { role: "assistant", text: "Payment cancelled." }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: `Error: ${error?.message || "Something went wrong. Try again."}` }]);
      }
    } finally {
      setLoading(false);
      setTxStep("");
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#010503", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden" }}>

      {/* Wallet Modal */}
      {showWalletModal && <WalletModal onConnect={handleWalletConnect} onClose={() => setShowWalletModal(false)} />}

      {/* BG */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.35 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: "35%", borderRadius: "50%", background: "rgba(16,185,129,0.04)", filter: "blur(120px)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.012, backgroundImage: "linear-gradient(rgba(16,185,129,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.2) 1px,transparent 1px)", backgroundSize: "55px 55px" }} />
      </div>

      {/* NAVBAR */}
      <nav style={{ position: "relative", zIndex: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(2,13,6,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(16,185,129,0.1)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#000", boxShadow: "0 0 10px rgba(16,185,129,0.3)" }}>M</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>MICRO<span style={{ color: "#34d399" }}>AI</span></div>
            <div style={{ fontSize: 6, color: "rgba(52,211,153,0.4)", letterSpacing: "0.15em", fontFamily: "monospace" }}>KNOWLEDGE HUB</div>
          </div>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Network selector */}
          <div ref={netMenuRef} style={{ position: "relative" }}>
            <button onClick={() => setShowNetMenu(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(52,211,153,0.18)", background: "rgba(1,8,3,0.8)", color: "#34d399", fontSize: 9, fontWeight: 700, fontFamily: "monospace", cursor: "pointer", letterSpacing: "0.08em" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite" }} />
              MAINNET
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showNetMenu ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showNetMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "rgba(2,10,5,0.98)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 10, overflow: "hidden", minWidth: 130, zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                <button onClick={() => setShowNetMenu(false)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "none", color: "#34d399", fontSize: 10, fontWeight: 700, fontFamily: "monospace", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />MAINNET<span style={{ marginLeft: "auto", fontSize: 8 }}>✓</span>
                </button>
              </div>
            )}
          </div>

          {/* Wallet */}
          {wallet ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(2,13,6,0.6)" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontFamily: "monospace", color: "#6ee7b7" }}>{wallet.slice(0, 5)}...{wallet.slice(-3)}</span>
              {balance !== null && <span style={{ fontSize: 9, fontFamily: "monospace", color: "#34d399", fontWeight: 700 }}>{balance}</span>}
              <button onClick={disconnect} style={{ background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
            </div>
          ) : (
            <button onClick={() => setShowWalletModal(true)} style={{ padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg,#10b981,#059669)", color: "#000", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", border: "none", cursor: "pointer", boxShadow: "0 0 12px rgba(16,185,129,0.25)", whiteSpace: "nowrap" }}>
              CONNECT
            </button>
          )}
        </div>
      </nav>

      {/* MESSAGES */}
      <div style={{ position: "relative", zIndex: 10, flex: 1, overflowY: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 28, paddingBottom: 16 }}>

          {messages.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60dvh", textAlign: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: 18, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 20, color: "#000", boxShadow: "0 0 28px rgba(16,185,129,0.3)", marginBottom: 20 }}>M</div>
              <h2 style={{ fontSize: "clamp(1.1rem,4vw,1.5rem)", fontWeight: 900, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.01em" }}>Arc & Circle Intelligence Hub</h2>
              <p style={{ fontSize: 12, color: "#475569", maxWidth: 320, lineHeight: 1.65, margin: "0 0 8px" }}>
                Pay <span style={{ color: "#34d399", fontWeight: 700 }}>0.001 USDC</span> per question, sent directly from your wallet.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, width: "100%", maxWidth: 480, marginTop: 8 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => wallet ? sendMessage(s.title) : setShowWalletModal(true)}
                    style={{ padding: "14px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.1)", background: "rgba(3,17,10,0.25)", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{s.desc}</div>
                  </button>
                ))}
              </div>

              {!wallet && (
                <button onClick={() => setShowWalletModal(true)} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(52,211,153,0.2)", background: "rgba(16,185,129,0.05)", color: "#34d399", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer" }}>
                  CONNECT WALLET TO START
                </button>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#000", flexShrink: 0, marginTop: 2 }}>M</div>
              )}
              <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2 }}>
                    <span style={{ fontSize: 8, fontFamily: "monospace", fontWeight: 700, color: "rgba(52,211,153,0.5)", letterSpacing: "0.12em" }}>MICRO_AI</span>
                    {msg.txHash && (
                      <a href={EXPLORER + msg.txHash} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, fontFamily: "monospace", color: "#334155", textDecoration: "none" }}>· TX PROOF ↗</a>
                    )}
                  </div>
                )}
                {msg.role === "user" ? (
                  <div style={{ padding: "10px 14px", borderRadius: "12px 12px 3px 12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(52,211,153,0.15)", color: "#d1fae5", fontSize: 13, lineHeight: 1.6 }}>{msg.text}</div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "#94a3b8" }} className="md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0" }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg,#34d399,#10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#000", flexShrink: 0 }}>M</div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#34d399", animation: "bounce 1.2s infinite", animationDelay: `${i*0.2}s` }} />)}
                </div>
                {txStep && <div style={{ fontSize: 9, fontFamily: "monospace", color: "#f59e0b" }}>{txStep}</div>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* INPUT */}
      <div style={{ position: "relative", zIndex: 20, flexShrink: 0, padding: "10px 14px 14px", background: "rgba(1,5,3,0.97)", borderTop: "1px solid rgba(16,185,129,0.08)", backdropFilter: "blur(20px)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {messages.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-end" }}>
              <button onClick={copyLastAnswer} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.1)", background: "rgba(0,0,0,0.2)", color: copied ? "#34d399" : "#475569", fontSize: 9, fontWeight: 700, fontFamily: "monospace", cursor: "pointer" }}>
                {copied ? "✓ COPIED" : "COPY LAST ANSWER"}
              </button>
              <button onClick={clearHistory} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.1)", background: "rgba(0,0,0,0.2)", color: "#475569", fontSize: 9, fontWeight: 700, fontFamily: "monospace", cursor: "pointer" }}>
                CLEAR CHAT
              </button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "rgba(3,19,11,0.6)", border: "1px solid rgba(16,185,129,0.12)", borderRadius: 16, padding: "10px 12px" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={!wallet ? "Connect wallet to start" : "Ask anything about Arc or Circle..."}
              disabled={!wallet || loading} rows={1}
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 13, color: "#fff", fontFamily: "inherit", lineHeight: 1.6, maxHeight: 100, scrollbarWidth: "none" }}
              onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 100) + "px"; }}
            />
            <button
              onClick={() => wallet ? sendMessage() : setShowWalletModal(true)}
              disabled={loading || !wallet}
              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: (wallet && input.trim()) ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(16,185,129,0.06)", boxShadow: (wallet && input.trim()) ? "0 0 10px rgba(16,185,129,0.3)" : "none" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={(wallet && input.trim()) ? "#000" : "#334155"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 6, fontSize: 8, fontFamily: "monospace", color: "#1e3a29", letterSpacing: "0.15em" }}>
            {txStep
              ? <span style={{ color: "#f59e0b", animation: "pulse 1.5s infinite" }}>{txStep.toUpperCase()}</span>
              : "ARC MAINNET · $0.001 USDC PER QUERY · CONFIRM IN WALLET"
            }
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #010503; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .md strong { color: #34d399; font-weight: 700; }
        .md p { margin: 6px 0; line-height: 1.7; }
        .md ul { list-style: disc; padding-left: 18px; margin: 8px 0; }
        .md ol { list-style: decimal; padding-left: 18px; margin: 8px 0; }
        .md li { color: #64748b; margin-bottom: 4px; }
        .md h1 { color: #fff; font-size: 15px; font-weight: 800; margin: 14px 0 6px; }
        .md h2 { color: #fff; font-size: 13px; font-weight: 700; margin: 12px 0 4px; }
        .md h3 { color: #34d399; font-size: 12px; font-weight: 700; margin: 10px 0 4px; }
        .md code { background: rgba(3,17,10,0.8); border: 1px solid rgba(16,185,129,0.15); padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #6ee7b7; font-family: monospace; }
        .md pre { background: rgba(2,10,5,0.9); border: 1px solid rgba(16,185,129,0.1); border-radius: 10px; padding: 14px; margin: 10px 0; overflow-x: auto; }
        .md pre code { background: none; border: none; padding: 0; }
        .md a { color: #34d399; }
        .md hr { border: none; border-top: 1px solid rgba(16,185,129,0.08); margin: 12px 0; }
      `}</style>
    </div>
  );
}
