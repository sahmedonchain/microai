"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedNumber } from "@/app/components/AnimatedNumber";

interface StatsData {
  totalQuestions: number;
  totalVolume: string;
  uniqueWallets: number;
  totalTransactions: number;
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      console.error("Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statItems = [
    { label: "Questions Asked", num: stats?.totalQuestions, icon: "💬", suffix: "" },
    { label: "USDC Volume", num: stats ? parseFloat(stats.totalVolume) : undefined, icon: "💰", suffix: " USDC" },
    { label: "Unique Wallets", num: stats?.uniqueWallets, icon: "👛", suffix: "" },
    { label: "Arc Transactions", num: stats?.totalTransactions, icon: "⛓️", suffix: "" },
  ];

  return (
    <section id="stats" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-[rgba(0,255,136,0.08)] border border-[rgba(0,255,136,0.2)] text-[#00ff88] text-xs px-4 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"></span>
          Live On-Chain Data from Arc MAINNET
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-3">Real Usage. Real Transactions.</h2>
        <p className="text-[#e5e5e5] text-base md:text-lg">Every number below is pulled directly from Arc blockchain.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
            whileHover={{ y: -3 }}
            className="bg-[#111111] border border-white/5 hover:border-[rgba(0,255,136,0.25)] rounded-2xl p-5 text-center transition-colors"
          >
            <div className="text-3xl mb-3">{item.icon}</div>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">
              {loading || item.num === undefined ? "..." : <AnimatedNumber value={item.num} />}
              <span className="text-sm text-[#7c3aed]">{item.suffix}</span>
            </div>
            <div className="text-xs text-[#aaaaaa]">{item.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="text-center mt-6">
        <a href="https://explorer.arc.io" target="_blank" rel="noreferrer" className="text-xs text-[#a78bfa] hover:text-[#c4b5fd] transition-colors">Verify all transactions on Arc Explorer</a>
      </div>
    </section>
  );
}
