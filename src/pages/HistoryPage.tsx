import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, ChevronRight, FileCode, Trash2, Search, Calendar } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, Spinner, EmptyState, Badge, Input, Button } from "../components/ui";
import { type Review } from "../lib/types";
import { clsx } from "clsx";

export function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setReviews((data as Review[]) || []);
      setLoading(false);
    })();
  }, [user]);

  async function deleteReview(id: string) {
    await supabase.from("reviews").delete().eq("id", id);
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  const filtered = reviews.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.language.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <History className="w-6 h-6 text-primary-500" />
          Review History
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <Input value={search} onChange={setSearch} placeholder="Search reviews..." className="pl-10" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="w-12 h-12" />}
            title={search ? "No matching reviews" : "No reviews yet"}
            description={search ? "Try a different search term." : "Your completed AI code reviews will appear here."}
            action={!search && <Button onClick={() => navigate("/review")}>Run a Review</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const issues = review.result?.issues || [];
            const criticalCount = issues.filter((i: any) => i.severity === "critical").length;
            const date = new Date(review.created_at);
            const scoreColor = review.score >= 80 ? "text-success-500" : review.score >= 60 ? "text-warning-500" : "text-error-500";

            return (
              <Card key={review.id} className="p-4 card-hover cursor-pointer" >
                <div className="flex items-center gap-4">
                  {/* Score */}
                  <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-surface-50 dark:bg-surface-800/50">
                    <span className={clsx("text-2xl font-bold", scoreColor)}>{review.score}</span>
                    <span className="text-xs text-surface-400">score</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCode className="w-4 h-4 text-surface-400 shrink-0" />
                      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">{review.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-surface-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Badge className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">{review.language}</Badge>
                      <Badge className="bg-primary-500/10 text-primary-500">{review.provider}</Badge>
                    </div>
                  </div>

                  {/* Issue counts */}
                  <div className="hidden md:flex items-center gap-2">
                    {criticalCount > 0 && <Badge className="bg-red-500/10 text-red-500">{criticalCount} Critical</Badge>}
                    {issues.length > 0 && <Badge className="bg-surface-100 dark:bg-surface-800 text-surface-500">{issues.length} Issues</Badge>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => deleteReview(review.id)} className="px-2 text-surface-400 hover:text-error-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <ChevronRight className="w-5 h-5 text-surface-300" />
                  </div>
                </div>

                {/* Summary */}
                {review.result?.summary && (
                  <p className="mt-3 text-sm text-surface-500 line-clamp-2 pl-20">{review.result.summary}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
