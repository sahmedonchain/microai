"use client";
import { useEffect, useState } from "react";

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
    { label: "Questions Asked", value: loading ? "..." : stats?.totalQuestions.toLocaleString() || "0", icon: "💬", suffix: "" },
    { label: "USDC Volume", value: loading ? "..." : stats?.totalVolume || "0", icon: "💰", suffix: " USDC" },
    { label: "Unique Wallets", value: loading ? "..." : stats?.uniqueWallets.toLocaleString() || "0", icon: "👛", suffix: "" },
    { label: "Arc Transactions", value: loading ? "..." : stats?.totalTransactions.toLocaleString() || "0", icon: "⛓️", suffix: "" },
  ];

  return (
    <section id="stats" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-700/30 text-green-300 text-xs px-4 py-1.5 rounded-full mb-4">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          Live On-Chain Data from Arc MAINNET
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Real Usage. Real Transactions.</h2>
        <p className="text-gray-400 text-sm md:text-base">Every number below is pulled directly from Arc blockchain.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statItems.map((item, i) => (
          <div key={i} className="bg-gray-900/60 border border-gray-800/50 hover:border-purple-700/40 rounded-2xl p-5 text-center transition-all">
            <div className="text-3xl mb-3">{item.icon}</div>
            <div className="text-2xl md:text-3xl font-bold text-white mb-1">
              {item.value}<span className="text-sm text-purple-400">{item.suffix}</span>
            </div>
            <div className="text-xs text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="text-center mt-6">
        <a href="https://explorer.arc.io" target="_blank" rel="noreferrer" className="text-xs text-purple-500 hover:text-purple-300 transition-colors">Verify all transactions on Arc Explorer</a>
      </div>
    </section>
  );
}
