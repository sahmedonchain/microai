"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "ECOSYSTEM", href: "/ecosystem" },
  { label: "GRANTS", href: "/grants" },
  { label: "DEBUGGER", href: "/debug" },
  { label: "STATS", href: "/stats" },
  { label: "BUILD", href: "/build-status" },
  { label: "NEWS", href: "/news" },
  { label: "COPILOT", href: "/build" },
  { label: "WALLET", href: "/wallet" },
  { label: "CREDITS", href: "/credits" },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(3,18,10,0.97)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(16,185,129,0.1)",
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
              background: "linear-gradient(135deg, #34d399, #10b981)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 13,
              color: "#000",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(16,185,129,0.3)",
            }}
          >
            M
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
              MICRO<span style={{ color: "#34d399" }}>AI</span>
            </div>
            <div
              style={{
                fontSize: 7,
                color: "rgba(52,211,153,0.5)",
                letterSpacing: "0.2em",
                fontFamily: "monospace",
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
                color: pathname === link.href ? "#34d399" : "#64748b",
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
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(52,211,153,0.25)",
              color: "#34d399",
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
          <button
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
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.15)",
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
                background: menuOpen ? "#34d399" : "#64748b",
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
                background: menuOpen ? "transparent" : "#64748b",
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
                background: menuOpen ? "#34d399" : "#64748b",
                borderRadius: 2,
                transition: "all 0.2s",
                transform: menuOpen ? "rotate(-45deg) translate(0px, -4.5px)" : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          style={{
            borderTop: "1px solid rgba(16,185,129,0.08)",
            padding: "8px 0 12px",
            background: "rgba(3,18,10,0.99)",
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
                fontFamily: "monospace",
                color: pathname === link.href ? "#34d399" : "#94a3b8",
                textDecoration: "none",
                borderBottom: "1px solid rgba(16,185,129,0.04)",
              }}
            >
              <span>{link.label}</span>
              {link.label === "GRANTS" && (
                <span
                  style={{
                    fontSize: 8,
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    color: "#34d399",
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
                background: "#10b981",
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
        </div>
      )}

      <style>{`
        .desktop-nav { display: none !important; }
        .hamburger-btn { display: flex !important; }
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .hamburger-btn { display: none !important; }
        }
      `}</style>
    </nav>
  );
}