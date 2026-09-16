"use client";
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/app/components/Navbar';

export default function Home() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('Ask me anything about Arc Chain deployment or Circle USDC integrations...');
  const [menuOpen, setMenuOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const setSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    setSize();
    window.addEventListener('resize', setSize);
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    for (let i = 0; i < 50; i++) {
      particles.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, size: Math.random() * 1.4 + 0.4, opacity: Math.random() * 0.16 + 0.04 });
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
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', setSize); };
  }, []);

  const presets = [
    { label: 'For Developers & Builders', key: 'ERC-8004', q: 'How do I implement ERC-8004 AI Agent on Arc?', r: 'To deploy ERC-8004 on Arc, initialize with Arc Agent Core SDK, specify runtime constraints, and use native USDC gas settlement.' },
    { label: 'For Fintech & Startups', key: 'CCTP', q: 'How do I integrate Circle CCTP for cross-chain payments?', r: 'Circle CCTP burns USDC on source chain and mints native USDC on Arc — no wrapped tokens, fully native settlement.' },
    { label: 'For Crypto Native & Traders', key: 'trades', q: 'How does DeFi and liquidity work on Arc?', r: 'Arc supports DeFi protocols with sub-second finality and USDC-native gas — ideal for liquidity pools and instant settlement.' },
  ];

  const navLinks = [
  { label: 'ECOSYSTEM', href: '/ecosystem' },
  { label: 'GRANTS', href: '/grants' },
  { label: 'DEBUGGER', href: '/debug' },
];

  return (
    <div style={{ minHeight: '100vh', background: '#010503', color: '#e2e8f0', overflowX: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.35, width: '100%', height: '100%' }} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: '50%', borderRadius: '50%', background: 'rgba(16,185,129,0.04)', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.012, backgroundImage: 'linear-gradient(rgba(16,185,129,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.2) 1px, transparent 1px)', backgroundSize: '55px 55px' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(16,185,129,0.05), transparent 70%)', left: mousePos.x - 200, top: mousePos.y - 200, transition: 'left 0.4s, top 0.4s' }} />
      </div>

      {/* NAVBAR */}
      <Navbar />

      {/* HERO */}
      <section style={{ position: 'relative', zIndex: 10, padding: 'clamp(40px,8vw,80px) 20px clamp(32px,5vw,52px)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.18)', background: 'rgba(3,17,10,0.7)', marginBottom: 24 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700, letterSpacing: '0.18em', fontFamily: 'monospace' }}>NOW LIVE ON MAINNET</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 8vw, 5rem)', fontWeight: 900, lineHeight: 1.05, margin: '0 0 20px', letterSpacing: '-0.03em' }}>
          <span style={{ display: 'block', background: 'linear-gradient(180deg, #ffffff 30%, rgba(255,255,255,0.7) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>The Arc & Circle</span>
          <span style={{ display: 'block', background: 'linear-gradient(180deg, rgba(52,211,153,0.9) 0%, rgba(16,185,129,0.4) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Intelligence Hub</span>
        </h1>

        <p style={{ fontSize: 'clamp(13px, 2.5vw, 16px)', color: '#64748b', maxWidth: 520, margin: '0 auto 32px', lineHeight: 1.7 }}>
          One AI engine trained on Arc and Circle documentation. Ask any question, get an instant verified answer — for just{' '}
          <span style={{ color: '#34d399', fontWeight: 700, background: 'rgba(16,185,129,0.08)', padding: '1px 6px', borderRadius: 5 }}>$0.001 USDC</span>
          {' '}per query, settled on-chain.
        </p>

        {/* Social proof bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(16px,4vw,36px)', marginBottom: 32, flexWrap: 'wrap' }}>
          {[
            { val: 'ERC-8004', label: 'Agent Registered' },
            { val: '$0.001', label: 'Per Question' },
            { val: 'Arc MAINNET', label: 'Live Now' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(13px,3vw,16px)', fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: '-0.01em' }}>{s.val}</div>
              <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.12em', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          <Link href="/chat" style={{ padding: '13px 28px', borderRadius: 12, background: 'linear-gradient(135deg,#10b981,#059669)', color: '#000', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textDecoration: 'none', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
            LAUNCH ENGINE →
          </Link>
          <Link href="/ecosystem" style={{ padding: '13px 28px', borderRadius: 12, border: '1px solid rgba(16,185,129,0.18)', background: 'rgba(16,185,129,0.04)', color: '#94a3b8', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textDecoration: 'none' }}>
            EXPLORE ECOSYSTEM
          </Link>
        </div>
      </section>

      {/* LIVE DEMO WIDGET */}
      <section style={{ position: 'relative', zIndex: 10, padding: '0 16px 56px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{ background: 'rgba(3,19,11,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: 20, overflow: 'hidden' }}>
          {/* Terminal bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(16,185,129,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(2,12,7,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#ef4444','#f59e0b','#34d399'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.6 }} />)}
              </div>
              <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', letterSpacing: '0.1em' }}>MICROAI — LIVE DEMO</span>
            </div>
            <span style={{ fontSize: 8, color: '#334155', fontFamily: 'monospace' }}>ARC MAINNET</span>
          </div>

          <div style={{ padding: '16px' }}>
            <div style={{ fontSize: 9, color: '#34d399', fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 10 }}>SELECT A QUERY TYPE</div>

            {/* Preset buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {presets.map(item => (
                <button key={item.key} onClick={() => { setChatInput(item.q); setChatResponse(item.r); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 10, border: chatInput === item.q ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(16,185,129,0.06)', background: chatInput === item.q ? 'rgba(16,185,129,0.07)' : 'rgba(0,0,0,0.15)', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 12, color: chatInput === item.q ? '#34d399' : '#64748b', fontWeight: 600 }}>{item.label}</span>
                  <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace', flexShrink: 0 }}>Try →</span>
                </button>
              ))}
            </div>

            {/* Response area */}
            <div style={{ background: 'rgba(1,6,3,0.7)', border: '1px solid rgba(16,185,129,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(16,185,129,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 8, color: 'rgba(52,211,153,0.5)', fontFamily: 'monospace', letterSpacing: '0.12em' }}>MICRO_AI · RESPONSE</span>
              </div>
              <div style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                {chatInput && (
                  <>
                    <div style={{ fontSize: 9, color: '#334155', marginBottom: 6 }}>&gt; {chatInput}</div>
                    <div style={{ height: 1, background: 'rgba(16,185,129,0.05)', marginBottom: 8 }} />
                  </>
                )}
                <div style={{ fontSize: 11, color: '#6ee7b7', lineHeight: 1.65 }}>{chatResponse}</div>
              </div>
              <div style={{ padding: '10px', background: 'rgba(1,5,2,0.8)', borderTop: '1px solid rgba(16,185,129,0.05)', display: 'flex', gap: 8 }}>
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a question..."
                  style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff', outline: 'none', fontFamily: 'monospace' }} />
                <Link href="/chat" style={{ padding: '8px 16px', background: '#10b981', color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'monospace', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  LAUNCH →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 COLUMNS: WHO IS IT FOR */}
      <section id="hub-sectors" style={{ position: 'relative', zIndex: 10, padding: 'clamp(36px,5vw,60px) 16px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'monospace', marginBottom: 10 }}>BUILT FOR EVERYONE IN THE ECOSYSTEM</div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 5vw, 2.8rem)', fontWeight: 900, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.02em' }}>One Hub. Every Role.</h2>
          <p style={{ fontSize: 13, color: '#475569', maxWidth: 460, margin: '0 auto', lineHeight: 1.65 }}>Whether you deploy contracts or onboard communities, MicroAI speaks your language.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {[
            { icon: '⬡', title: 'Developers & Builders', color: '#34d399', points: ['Smart Contract Development', 'AI Agent Setup (ERC-8004)', 'Agentic Commerce (ERC-8183)', 'Frontend dApp Building'] },
            { icon: '◈', title: 'Fintech & Startups', color: '#60a5fa', points: ['Cross-border Payment Apps', 'Treasury & Payroll Systems', 'Circle CCTP Integration', 'FX & Stablecoin Settlement'] },
            { icon: '◇', title: 'Crypto Native', color: '#a78bfa', points: ['DeFi Protocol Building', 'Liquidity & AMM Setup', 'Cross-chain Bridges', 'Chainlink Oracle Setup'] },
            { icon: '○', title: 'New to Arc', color: '#f59e0b', points: ['Getting Started Guides', 'Hackathon & Grant Help', 'Faucet & Wallet Setup', 'Arc House & Discord FAQ'] },
          ].map(sector => (
            <div key={sector.title} style={{ padding: '20px', borderRadius: 14, background: 'rgba(3,17,10,0.18)', border: '1px solid rgba(16,185,129,0.07)', transition: 'border-color 0.2s' }}>
              <div style={{ fontSize: 18, marginBottom: 12, color: sector.color, opacity: 0.7 }}>{sector.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 12, letterSpacing: '-0.01em' }}>{sector.title}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {sector.points.map((p, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#475569', alignItems: 'flex-start' }}>
                    <span style={{ color: sector.color, flexShrink: 0, opacity: 0.6, marginTop: 1 }}>—</span><span>{p}</span>
                  </li>
                ))}
              </ul>
              <Link href="/chat" style={{ display: 'inline-block', marginTop: 16, fontSize: 9, color: sector.color, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.12em', textDecoration: 'none', opacity: 0.7 }}>
                ASK NOW →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ position: 'relative', zIndex: 10, padding: 'clamp(36px,5vw,56px) 16px', background: 'rgba(2,10,5,0.5)', borderTop: '1px solid rgba(16,185,129,0.05)', borderBottom: '1px solid rgba(16,185,129,0.05)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'monospace', marginBottom: 10 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Pay once. Get the answer.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 4 }}>
            {[
              { n: '1', name: 'Connect Wallet', desc: 'MetaMask on Arc MAINNET. Takes 30 seconds.' },
              { n: '2', name: 'Ask Your Question', desc: 'Anything about Arc SDK, Circle APIs, or smart contracts.' },
              { n: '3', name: 'Sign 0.001 USDC', desc: 'One click in your wallet. No subscription, no account.' },
              { n: '4', name: 'Get the Answer', desc: 'Instant response with on-chain TX proof on Arc Explorer.' },
            ].map((s, i, arr) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <div style={{ flex: 1, padding: '18px 16px', borderRadius: 12, background: 'rgba(3,14,8,0.4)', border: '1px solid rgba(16,185,129,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(52,211,153,0.3)', fontFamily: 'monospace', marginBottom: 8 }}>{s.n}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{s.name}</div>
                  <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', marginTop: 28, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#1e3a29' }}>›</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link href="/chat" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: '#10b981', color: '#000', fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', textDecoration: 'none', boxShadow: '0 0 18px rgba(16,185,129,0.2)' }}>
              START FOR $0.001 →
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ position: 'relative', zIndex: 10, padding: 'clamp(36px,5vw,56px) 16px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'monospace', marginBottom: 10 }}>WHAT'S INSIDE</div>
          <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 2.2rem)', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>Trained on Real Docs</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {[
            { title: 'Full Protocol Coverage', desc: 'Arc docs, Circle developer docs, CCTP, ERC-8004, ERC-8183 — all in the knowledge base.' },
            { title: 'Verified Contract Addresses', desc: 'USDC, EURC, TokenMessengerV2, MessageTransmitterV2 — never guess an address again.' },
            { title: 'Code Examples', desc: 'Ask for a Hardhat config, a Solidity snippet, or a Circle API call — get working code.' },
            { title: 'Error Debugging', desc: 'Paste your error or trace log. Get Arc-specific, context-aware debugging help instantly.' },
            { title: 'Grants & Opportunities', desc: 'Every live Arc + Circle grant, hackathon, and bounty tracked in one place.' },
            { title: 'Ecosystem Directory', desc: '41 projects across 11 categories — from MetaMask and Aave to BlackRock and Goldman Sachs.' },
          ].map(f => (
            <div key={f.title} style={{ padding: '18px', borderRadius: 12, background: 'rgba(3,12,7,0.3)', border: '1px solid rgba(16,185,129,0.06)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(52,211,153,0.3)', marginBottom: 12 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 7 }}>{f.title}</div>
              <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ position: 'relative', zIndex: 10, padding: 'clamp(36px,5vw,56px) 16px', textAlign: 'center', background: 'rgba(2,10,5,0.3)', borderTop: '1px solid rgba(16,185,129,0.05)' }}>
        <div style={{ maxWidth: 360, margin: '0 auto' }}>
          <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'monospace', marginBottom: 10 }}>PRICING</div>
          <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 2rem)', fontWeight: 900, color: '#fff', margin: '0 0 24px', letterSpacing: '-0.02em' }}>No subscription.<br />Pay per answer.</h2>
          <div style={{ background: 'rgba(3,14,8,0.8)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: 20, padding: '28px 22px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.3), transparent)' }} />
            <div style={{ fontSize: 'clamp(2.8rem,10vw,4rem)', fontWeight: 900, color: '#fff', fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>$0.001</div>
            <div style={{ fontSize: 9, color: '#34d399', fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'monospace', marginTop: 8, marginBottom: 20 }}>USDC · PER QUERY · ON-CHAIN</div>
            <div style={{ height: 1, background: 'rgba(16,185,129,0.08)', marginBottom: 18 }} />
            <ul style={{ textAlign: 'left', margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'No monthly subscription',
                'No account or email required',
                'Every answer logged on Arc Explorer',
                'Full ecosystem access included',
              ].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#64748b' }}>
                  <span style={{ color: '#34d399', flexShrink: 0, fontSize: 10 }}>✓</span> {item}
                </li>
              ))}
            </ul>
            <Link href="/chat" style={{ display: 'block', marginTop: 20, padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg, #34d399, #10b981)', color: '#000', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textDecoration: 'none' }}>
              ASK YOUR FIRST QUESTION →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(16,185,129,0.07)', background: '#010402', padding: '22px 16px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#34d399' }}>M</div>
            <div style={{ fontSize: 9, color: '#1e3a29', fontFamily: 'monospace', letterSpacing: '0.1em' }}>MICROAI · ARC & CIRCLE INTELLIGENCE HUB</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[{ l: 'ARC', h: 'https://arc.io' }, { l: 'CIRCLE', h: 'https://circle.com' }, { l: 'GITHUB', h: 'https://github.com/sahmedonchain/microai' }, { l: 'EXPLORER', h: 'https://explorer.arc.io' }].map(link => (
              <a key={link.l} href={link.h} target="_blank" rel="noreferrer" style={{ fontSize: 9, color: '#1e3a29', fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace', textDecoration: 'none' }}>{link.l}</a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        html, body { background: #010503; margin: 0; overflow-x: hidden; scrollbar-width: none; }
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .desktop-nav { display: none !important; }
        .hamburger-btn { display: flex !important; }
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .hamburger-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}