import { useEffect, useState } from "react";
import {
  FileBarChart, Download, FileText, Shield, Gauge, Building2,
  Wrench,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Card, Button, Spinner, EmptyState, Select, ScoreRing, Badge } from "../components/ui";
import { SEVERITY_CONFIG, type Review, type ReviewResult } from "../lib/types";
import { clsx } from "clsx";

export function ReportsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [exportFormat, setExportFormat] = useState("markdown");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setReviews((data as Review[]) || []);
      if (data && data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    })();
  }, [user]);

  const selected = reviews.find((r) => r.id === selectedId);
  const result = selected?.result;

  function exportReport(format: string) {
    if (!selected || !result) return;
    let content = "";
    let filename = "";
    let mime = "text/plain";

    if (format === "markdown") {
      content = generateMarkdown(selected, result);
      filename = `report-${selected.id}.md`;
      mime = "text/markdown";
    } else if (format === "html") {
      content = generateHTML(selected, result);
      filename = `report-${selected.id}.html`;
      mime = "text/html";
    } else if (format === "csv") {
      content = generateCSV(result);
      filename = `issues-${selected.id}.csv`;
      mime = "text/csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6 flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-primary-500" />
          Reports
        </h1>
        <Card>
          <EmptyState
            icon={<FileBarChart className="w-12 h-12" />}
            title="No reports available"
            description="Run AI code reviews to generate detailed reports with security, performance, and quality analysis."
          />
        </Card>
      </div>
    );
  }

  const issues = result?.issues || [];
  const issuesByCategory: Record<string, any[]> = {};
  issues.forEach((i: any) => {
    if (!issuesByCategory[i.category]) issuesByCategory[i.category] = [];
    issuesByCategory[i.category].push(i);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-primary-500" />
          Reports
        </h1>
        <div className="flex items-center gap-2">
          <Select value={exportFormat} onChange={setExportFormat} className="w-32">
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="csv">CSV (Issues)</option>
          </Select>
          <Button onClick={() => exportReport(exportFormat)}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Review selector */}
      <Card className="p-4 mb-4">
        <label className="block text-xs font-medium text-surface-500 mb-1.5">Select Review</label>
        <Select value={selectedId} onChange={setSelectedId} className="w-full">
          {reviews.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title} - {r.language} - Score: {r.score} - {new Date(r.created_at).toLocaleDateString()}
            </option>
          ))}
        </Select>
      </Card>

      {selected && result && (
        <div className="space-y-4">
          {/* Executive Summary */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-surface-800 dark:text-surface-200">Executive Summary</h3>
            </div>
            <div className="flex items-start gap-6">
              <ScoreRing score={result.score} size={120} />
              <div className="flex-1">
                <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed mb-3">{result.summary}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-primary-500/10 text-primary-500">{selected.language}</Badge>
                  <Badge className="bg-accent-500/10 text-accent-500">{selected.provider}</Badge>
                  <Badge className="bg-surface-100 dark:bg-surface-800 text-surface-500">{issues.length} Issues</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Metric cards */}
          {result.metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ReportSection icon={<Shield className="w-4 h-4" />} title="Security Report" score={result.metrics.security_score}>
                {issuesByCategory["Security"]?.map((i, idx) => (
                  <IssueRow key={idx} issue={i} />
                ))}
                {!issuesByCategory["Security"]?.length && <p className="text-xs text-surface-400">No security issues detected.</p>}
              </ReportSection>

              <ReportSection icon={<Gauge className="w-4 h-4" />} title="Performance Report" score={result.metrics.performance_score}>
                {issuesByCategory["Performance"]?.map((i, idx) => (
                  <IssueRow key={idx} issue={i} />
                ))}
                {!issuesByCategory["Performance"]?.length && <p className="text-xs text-surface-400">No performance issues detected.</p>}
              </ReportSection>

              <ReportSection icon={<Building2 className="w-4 h-4" />} title="Architecture Report" score={result.metrics.maintainability}>
                {issuesByCategory["Architecture"]?.map((i, idx) => (
                  <IssueRow key={idx} issue={i} />
                ))}
                {!issuesByCategory["Architecture"]?.length && <p className="text-xs text-surface-400">No architecture issues detected.</p>}
              </ReportSection>

              <ReportSection icon={<Wrench className="w-4 h-4" />} title="Maintainability Report" score={result.metrics.code_quality_score}>
                {issuesByCategory["Maintainability"]?.concat(issuesByCategory["Code Quality"] || []).map((i, idx) => (
                  <IssueRow key={idx} issue={i} />
                ))}
                {!issuesByCategory["Maintainability"]?.length && !issuesByCategory["Code Quality"]?.length && <p className="text-xs text-surface-400">No maintainability issues detected.</p>}
              </ReportSection>
            </div>
          )}

          {/* All issues table */}
          <Card className="p-5">
            <h3 className="font-semibold text-surface-800 dark:text-surface-200 mb-3">All Issues</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-800 text-left text-xs text-surface-500">
                    <th className="py-2 px-3">Severity</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Line</th>
                    <th className="py-2 px-3">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue: any, idx: number) => {
                    const cfg = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG];
                    return (
                      <tr key={idx} className="border-b border-surface-100 dark:border-surface-800/50 hover:bg-surface-50 dark:hover:bg-surface-800/30">
                        <td className="py-2 px-3">
                          <span className={clsx("badge", cfg.bgColor, cfg.textColor)}>{cfg.label}</span>
                        </td>
                        <td className="py-2 px-3 text-surface-600 dark:text-surface-400">{issue.category}</td>
                        <td className="py-2 px-3 text-surface-800 dark:text-surface-200">{issue.title}</td>
                        <td className="py-2 px-3 text-surface-400 font-mono">{issue.line_start || "-"}</td>
                        <td className="py-2 px-3 text-surface-400 font-mono">{issue.rule_id || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReportSection({ icon, title, score, children }: { icon: React.ReactNode; title: string; score: number; children: React.ReactNode }) {
  const color = score >= 80 ? "text-success-500" : score >= 60 ? "text-warning-500" : "text-error-500";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-primary-500">{icon}</span>
          <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300">{title}</h4>
        </div>
        <span className={clsx("text-lg font-bold", color)}>{score}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function IssueRow({ issue }: { issue: any }) {
  const cfg = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG];
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/30">
      <div className={clsx("w-2 h-2 rounded-full mt-1.5 shrink-0", cfg.bgColor)} style={{ backgroundColor: cfg.color }} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{issue.title}</p>
        <p className="text-xs text-surface-400 line-clamp-2">{issue.description}</p>
      </div>
    </div>
  );
}

function generateMarkdown(review: Review, result: ReviewResult): string {
  const issues = result.issues || [];
  let md = `# AI Code Review Report\n\n`;
  md += `**Review ID:** ${review.id}\n`;
  md += `**Language:** ${review.language}\n`;
  md += `**Provider:** ${review.provider}\n`;
  md += `**Model:** ${review.model}\n`;
  md += `**Date:** ${new Date(review.created_at).toISOString()}\n`;
  md += `**Score:** ${result.score}/100\n\n`;
  md += `## Executive Summary\n\n${result.summary}\n\n`;
  if (result.metrics) {
    md += `## Metrics\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Security Score | ${result.metrics.security_score} |\n`;
    md += `| Performance Score | ${result.metrics.performance_score} |\n`;
    md += `| Code Quality Score | ${result.metrics.code_quality_score} |\n`;
    md += `| Maintainability | ${result.metrics.maintainability} |\n`;
    md += `| Complexity | ${result.metrics.complexity} |\n`;
    md += `| LOC | ${result.metrics.estimated_loc} |\n`;
    md += `| Duplicate Blocks | ${result.metrics.duplicate_blocks} |\n`;
    md += `| Code Smells | ${result.metrics.code_smells} |\n\n`;
  }
  md += `## Issues (${issues.length})\n\n`;
  issues.forEach((i, idx) => {
    md += `### ${idx + 1}. [${i.severity.toUpperCase()}] ${i.title}\n\n`;
    md += `- **Category:** ${i.category}\n`;
    md += `- **Rule:** ${i.rule_id || "N/A"}\n`;
    if (i.line_start) md += `- **Lines:** ${i.line_start}${i.line_end ? `-${i.line_end}` : ""}\n`;
    md += `\n${i.description}\n`;
    if (i.suggestion) md += `\n**Suggestion:**\n\`\`\`\n${i.suggestion}\n\`\`\`\n`;
    md += `\n`;
  });
  if (result.refactored_code) {
    md += `## Refactored Code\n\n${result.refactoring_explanation}\n\n\`\`\`${review.language}\n${result.refactored_code}\n\`\`\`\n`;
  }
  return md;
}

function generateHTML(review: Review, result: ReviewResult): string {
  const issues = result.issues || [];
  const sevColors: Record<string, string> = { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#2563eb", info: "#0891b2" };
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Code Review Report</title>
<style>
  body { font-family: Inter, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1e293b; }
  h1 { color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
  h2 { color: #334155; margin-top: 24px; }
  .meta { background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .meta div { margin: 4px 0; }
  .score { font-size: 48px; font-weight: bold; color: ${sevColors[result.score >= 80 ? "low" : result.score >= 60 ? "medium" : "critical"]}; }
  .issue { border-left: 4px solid; padding: 12px 16px; margin: 8px 0; background: #f8fafc; border-radius: 4px; }
  .severity { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; color: white; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  th { background: #f1f5f9; }
  pre { background: #1e293b; color: #f1f5f9; padding: 16px; border-radius: 8px; overflow-x: auto; }
</style></head><body>
<h1>AI Code Review Report</h1>
<div class="meta">
  <div><strong>Language:</strong> ${review.language}</div>
  <div><strong>Provider:</strong> ${review.provider} (${review.model})</div>
  <div><strong>Date:</strong> ${new Date(review.created_at).toLocaleString()}</div>
  <div><strong>Score:</strong> <span class="score">${result.score}/100</span></div>
</div>
<h2>Executive Summary</h2>
<p>${result.summary}</p>
${result.metrics ? `<h2>Metrics</h2><table>
<tr><th>Metric</th><th>Value</th></tr>
<tr><td>Security</td><td>${result.metrics.security_score}</td></tr>
<tr><td>Performance</td><td>${result.metrics.performance_score}</td></tr>
<tr><td>Code Quality</td><td>${result.metrics.code_quality_score}</td></tr>
<tr><td>Maintainability</td><td>${result.metrics.maintainability}</td></tr>
<tr><td>Complexity</td><td>${result.metrics.complexity}</td></tr>
</table>` : ""}
<h2>Issues (${issues.length})</h2>
${issues.map(i => `<div class="issue" style="border-color: ${sevColors[i.severity] || "#64748b"}">
  <span class="severity" style="background: ${sevColors[i.severity] || "#64748b"}">${i.severity.toUpperCase()}</span>
  <strong>${i.title}</strong> <em>[${i.category}]</em>
  ${i.line_start ? `<br><small>Line ${i.line_start}${i.line_end ? `-${i.line_end}` : ""}</small>` : ""}
  <p>${i.description}</p>
  ${i.suggestion ? `<pre>${i.suggestion}</pre>` : ""}
</div>`).join("")}
${result.refactored_code ? `<h2>Refactored Code</h2><p>${result.refactoring_explanation}</p><pre>${result.refactored_code}</pre>` : ""}
</body></html>`;
}

function generateCSV(result: ReviewResult): string {
  const issues = result.issues || [];
  let csv = "Severity,Category,Title,Description,Line Start,Line End,Rule ID,Suggestion\n";
  issues.forEach((i) => {
    const desc = (i.description || "").replace(/"/g, '""').replace(/\n/g, " ");
    const title = (i.title || "").replace(/"/g, '""');
    const suggestion = (i.suggestion || "").replace(/"/g, '""').replace(/\n/g, " ");
    csv += `"${i.severity}","${i.category}","${title}","${desc}",${i.line_start || ""},${i.line_end || ""},"${i.rule_id || ""}","${suggestion}"\n`;
  });
  return csv;
}
