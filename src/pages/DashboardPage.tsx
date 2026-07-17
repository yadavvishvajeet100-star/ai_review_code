import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { LayoutDashboard, TrendingUp, Shield, Bug, Activity, FileCode } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, Spinner, EmptyState } from "../components/ui";

interface ReviewRow {
  id: string;
  score: number;
  language: string;
  provider: string;
  created_at: string;
  result: any;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, criticalIssues: 0, totalIssues: 0 });

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("reviews")
        .select("id, score, language, provider, created_at, result")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const revs = data || [];
      setReviews(revs);

      const totalIssues = revs.reduce((sum, r) => sum + (r.result?.issues?.length || 0), 0);
      const criticalIssues = revs.reduce((sum, r) =>
        sum + (r.result?.issues?.filter((i: any) => i.severity === "critical").length || 0), 0);
      const avgScore = revs.length > 0 ? Math.round(revs.reduce((sum, r) => sum + r.score, 0) / revs.length) : 0;

      setStats({ total: revs.length, avgScore, criticalIssues, totalIssues });
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary-500" />
          Dashboard
        </h1>
        <Card>
          <EmptyState
            icon={<Activity className="w-12 h-12" />}
            title="No reviews yet"
            description="Run your first AI code review to see analytics, trends, and insights here."
          />
        </Card>
      </div>
    );
  }

  // Score trend (last 20 reviews, reversed for chronological)
  const scoreTrend = [...reviews].reverse().slice(-20).map((r, i) => ({
    name: `#${i + 1}`,
    score: r.score,
  }));

  // Language distribution
  const langCounts: Record<string, number> = {};
  reviews.forEach((r) => { langCounts[r.language] = (langCounts[r.language] || 0) + 1; });
  const langData = Object.entries(langCounts).map(([name, value]) => ({ name, value }));

  // Issue severity distribution
  const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  reviews.forEach((r) => {
    (r.result?.issues || []).forEach((i: any) => {
      if (severityCounts[i.severity] !== undefined) severityCounts[i.severity]++;
    });
  });
  const severityData = Object.entries(severityCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const SEVERITY_COLORS: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#2563eb", info: "#0891b2" };

  // Weekly trend
  const weekData: Record<string, { reviews: number; score: number; count: number }> = {};
  reviews.forEach((r) => {
    const d = new Date(r.created_at);
    const week = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!weekData[week]) weekData[week] = { reviews: 0, score: 0, count: 0 };
    weekData[week].reviews++;
    weekData[week].score += r.score;
    weekData[week].count++;
  });
  const weeklyTrend = Object.entries(weekData).map(([name, d]) => ({
    name,
    reviews: d.reviews,
    avgScore: Math.round(d.score / d.count),
  })).slice(-8);

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6 flex items-center gap-2">
        <LayoutDashboard className="w-6 h-6 text-primary-500" />
        Dashboard
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<FileCode className="w-5 h-5" />} label="Total Reviews" value={stats.total} color="text-primary-500" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg Score" value={stats.avgScore} color="text-success-500" />
        <StatCard icon={<Bug className="w-5 h-5" />} label="Total Issues" value={stats.totalIssues} color="text-warning-500" />
        <StatCard icon={<Shield className="w-5 h-5" />} label="Critical Issues" value={stats.criticalIssues} color="text-error-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Score Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={scoreTrend}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
              <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} fill="url(#scoreGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Issue Severity Distribution</h3>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={SEVERITY_COLORS[entry.name] || "#64748b"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-surface-400">No issues found</div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Language Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={langData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={80} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
              <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="reviews" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgScore" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="p-5 card-hover">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-surface-500">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-surface-900 dark:text-surface-100">{value}</p>
    </Card>
  );
}
