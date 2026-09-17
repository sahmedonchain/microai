"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "ECOSYSTEM", href: "/ecosystem" },
  { label: "GRANTS", href: "/grants" },
  { label: "DEBUGGER", href: "/debug" },
  { label: "STATS", href: "/stats" },
  { label: "BUILD", href: "/build-status" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.97)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,255,136,0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #00ff88, #00ff88)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 13,
              color: "#000",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(0,255,136,0.3)",
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
              MICRO<span style={{ color: "#00ff88" }}>AI</span>
            </div>
            <div
              style={{
                fontSize: 7,
                color: "rgba(0,255,136,0.5)",
                letterSpacing: "0.2em",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              THE KNOWLEDGE HUB
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div
          className="desktop-nav"
          style={{
            gap: 20,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              style={{
                textDecoration: "none",
                color: pathname === link.href ? "#00ff88" : "#aaaaaa",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/chat"
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.25)",
              color: "#00ff88",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            LAUNCH →
          </Link>

          {/* Hamburger */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMenuOpen(!menuOpen)}
            className="hamburger-btn"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 5,
              width: 36,
              height: 36,
              background: "rgba(0,255,136,0.06)",
              border: "1px solid rgba(0,255,136,0.15)",
              borderRadius: 9,
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "block",
                width: 16,
                height: 1.5,
                background: menuOpen ? "#00ff88" : "#aaaaaa",
                borderRadius: 2,
                transition: "all 0.2s",
                transform: menuOpen ? "rotate(45deg) translate(0px, 4.5px)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: 16,
                height: 1.5,
                background: menuOpen ? "transparent" : "#aaaaaa",
                borderRadius: 2,
                transition: "all 0.2s",
                opacity: menuOpen ? 0 : 1,
              }}
            />
            <span
              style={{
                display: "block",
                width: 16,
                height: 1.5,
                background: menuOpen ? "#00ff88" : "#aaaaaa",
                borderRadius: 2,
                transition: "all 0.2s",
                transform: menuOpen ? "rotate(-45deg) translate(0px, -4.5px)" : "none",
              }}
            />
          </motion.button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
      {menuOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            borderTop: "1px solid rgba(0,255,136,0.08)",
            padding: "8px 0 12px",
            background: "rgba(0,0,0,0.99)",
            overflow: "hidden",
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                fontFamily: "var(--font-geist-mono), monospace",
                color: pathname === link.href ? "#00ff88" : "#aaaaaa",
                textDecoration: "none",
                borderBottom: "1px solid rgba(0,255,136,0.04)",
              }}
            >
              <span>{link.label}</span>
              {link.label === "GRANTS" && (
                <span
                  style={{
                    fontSize: 8,
                    background: "rgba(124,58,237,0.15)",
                    border: "1px solid rgba(124,58,237,0.3)",
                    color: "#a78bfa",
                    padding: "2px 7px",
                    borderRadius: 4,
                    letterSpacing: "0.1em",
                  }}
                >
                  LIVE
                </span>
              )}
            </Link>
          ))}
          <div style={{ padding: "12px 20px 4px" }}>
            <Link
              href="/chat"
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                textAlign: "center",
                padding: "11px",
                borderRadius: 10,
                background: "#00ff88",
                color: "#000",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textDecoration: "none",
              }}
            >
              LAUNCH CHAT TERMINAL →
            </Link>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      <style>{`
        .desktop-nav { display: none !important; }
        .hamburger-btn { display: flex !important; }
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .hamburger-btn { display: none !important; }
        }
      `}</style>
    </motion.nav>
  );
}