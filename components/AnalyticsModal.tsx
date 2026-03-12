//components/AnalyticsModal.tsx

"use client";

import { useEffect, useState } from "react";
import { X, Loader2, BarChart3, Globe, Link2 } from "lucide-react"; 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsModalProps {
  slug: string;
  onClose: () => void;
}

interface StatsData {
  total: number;
  chartData: { date: string; count: number }[];
  topBrowsers: { name: string; value: number }[];
  topOS: { name: string; value: number }[];
  topCountries: { name: string; value: number }[];
  topReferrers: { name: string; value: number }[];
}

export default function AnalyticsModal({ slug, onClose }: AnalyticsModalProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/links/${slug}/stats`).then((res) => res.json()).then((res) => {
        setData(res); setLoading(false);
      }).catch(() => setLoading(false));
  }, [slug]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="db-card relative w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 shadow-[12px_12px_0px_0px_var(--db-border)]">
        
        <div className="flex items-center justify-between mb-6 border-b-4 border-(--db-border) pb-4">
          <div>
            <h2 className="text-xl font-black uppercase flex items-center gap-2 text-(--db-text)">
              <BarChart3 className="h-6 w-6 text-(--db-primary)" />
              Analytics: <span className="font-mono bg-(--db-accent) px-2 text-black">/{slug}</span>
            </h2>
            <p className="text-xs font-bold uppercase tracking-widest text-(--db-text-muted) mt-1">Performance Data (7 Days)</p>
          </div>
          <button onClick={onClose} className="border-2 border-(--db-border) p-2 hover:bg-red-500 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="h-60 flex items-center justify-center text-(--db-text-muted) font-bold animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin mr-2" /> LOADING DATA...
          </div>
        ) : !data ? (
          <div className="h-40 flex items-center justify-center font-bold text-red-500 border-2 border-dashed border-(--db-border)">
            FAILED TO LOAD DATA.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "TOTAL CLICKS", value: data.total, icon: null },
                { label: "TOP COUNTRY", value: data.topCountries[0]?.name || "-", icon: <Globe className="h-4 w-4"/> },
                { label: "TOP SOURCE", value: data.topReferrers[0]?.name || "-", icon: <Link2 className="h-4 w-4"/> } 
              ].map((stat, i) => (
                <div key={i} className="p-4 bg-(--db-bg) border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-(--db-text-muted) mb-1">{stat.label}</p>
                  <div className="flex items-center gap-2 text-(--db-text)">
                     {stat.icon}
                     <p className="text-2xl font-black truncate">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="h-64 w-full p-2 border-2 border-(--db-border) bg-(--db-surface)">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--db-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--db-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--db-text-muted)" opacity={0.2} />
                  <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(str) => str.slice(5)} stroke="var(--db-text)" />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} stroke="var(--db-text)" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0px', border: '2px solid var(--db-border)', boxShadow: '4px 4px 0px 0px var(--db-border)', backgroundColor: 'var(--db-surface)' }}
                    itemStyle={{ color: 'var(--db-text)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="var(--db-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: "TOP BROWSERS", list: data.topBrowsers },
                { title: "TOP OS", list: data.topOS },
                { title: "TOP LOCATIONS", list: data.topCountries },
                { title: "TOP REFERRERS", list: data.topReferrers }
              ].map((section, idx) => (
                <div key={idx}>
                   <h3 className="text-sm font-black uppercase border-b-2 border-(--db-border) mb-3 pb-1 text-(--db-text)">{section.title}</h3>
                   <div className="space-y-2">
                      {section.list.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-(--db-bg) border-2 border-(--db-border) text-(--db-text)">
                          <span className="font-bold truncate max-w-37.5">{item.name || "Unknown"}</span>
                          <span className="font-mono bg-(--db-primary) text-(--db-primary-fg) px-1.5">{item.value}</span>
                        </div>
                      ))}
                      {section.list.length === 0 && <p className="text-xs font-medium text-(--db-text-muted)">No data recorded.</p>}
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
