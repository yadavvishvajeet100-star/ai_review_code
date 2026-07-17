import { useState } from "react";
import {
  ShieldAlert, Gauge, Bug, Code2, Building2, CheckCircle2,
  Wrench, Package, ChevronDown, ChevronRight, Lightbulb,
  FileText, FileCode,
} from "lucide-react";
import {
  SEVERITY_CONFIG, type ReviewResult, type ReviewIssue,
  type IssueCategory, type Severity,
} from "../lib/types";
import { Card, ScoreRing, Badge, Button } from "./ui";
import { clsx } from "clsx";
import { diffWords } from "diff";

const ICONS: Record<string, any> = {
  ShieldAlert, Gauge, Bug, Code2, Building2, CheckCircle2, Wrench, Package,
};

const CATEGORIES: IssueCategory[] = ["Security", "Performance", "Bug", "Code Quality", "Architecture", "Best Practice", "Maintainability", "Dependency"];

export function ReviewResults({ result, code, language }: { result: ReviewResult; code?: string; language?: string }) {
  const [activeSeverity, setActiveSeverity] = useState<Severity | "all">("all");
  const [activeCategory, setActiveCategory] = useState<IssueCategory | "all">("all");
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [showRefactored, setShowRefactored] = useState(false);

  const issues = result.issues || [];
  const filtered = issues.filter((i) =>
    (activeSeverity === "all" || i.severity === activeSeverity) &&
    (activeCategory === "all" || i.category === activeCategory)
  );

  const counts = {
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    info: issues.filter((i) => i.severity === "info").length,
  };

  function toggleIssue(idx: number) {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score and summary */}
      <Card className="p-5">
        <div className="flex items-start gap-5">
          <ScoreRing score={result.score} size={100} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-1">Review Summary</h3>
            <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{result.summary}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {counts.critical > 0 && <Badge className="bg-red-500/10 text-red-500">{counts.critical} Critical</Badge>}
              {counts.high > 0 && <Badge className="bg-orange-500/10 text-orange-500">{counts.high} High</Badge>}
              {counts.medium > 0 && <Badge className="bg-yellow-500/10 text-yellow-500">{counts.medium} Medium</Badge>}
              {counts.low > 0 && <Badge className="bg-blue-500/10 text-blue-500">{counts.low} Low</Badge>}
              {counts.info > 0 && <Badge className="bg-cyan-500/10 text-cyan-500">{counts.info} Info</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      {result.metrics && (
        <Card className="p-5">
          <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3">Quality Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBar label="Security" score={result.metrics.security_score} />
            <MetricBar label="Performance" score={result.metrics.performance_score} />
            <MetricBar label="Code Quality" score={result.metrics.code_quality_score} />
            <MetricBar label="Maintainability" score={result.metrics.maintainability} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <MetricStat label="Complexity" value={result.metrics.complexity} />
            <MetricStat label="LOC" value={result.metrics.estimated_loc} />
            <MetricStat label="Duplicates" value={result.metrics.duplicate_blocks} />
            <MetricStat label="Code Smells" value={result.metrics.code_smells} />
          </div>
        </Card>
      )}

      {/* Code Snapshot with highlighted issues */}
      {code && (
        <CodeSnapshot code={code} issues={issues} language={language || "typescript"} />
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <FilterChip label="All" count={issues.length} active={activeSeverity === "all"} onClick={() => setActiveSeverity("all")} />
          {(Object.keys(SEVERITY_CONFIG) as Severity[]).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <FilterChip
                key={sev}
                label={cfg.label}
                count={counts[sev]}
                active={activeSeverity === sev}
                onClick={() => setActiveSeverity(activeSeverity === sev ? "all" : sev)}
                color={cfg.color}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="All Categories" count={issues.length} active={activeCategory === "all"} onClick={() => setActiveCategory("all")} small />
          {CATEGORIES.map((cat) => {
            const count = issues.filter((i) => i.category === cat).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={cat}
                label={cat}
                count={count}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(activeCategory === cat ? "all" : cat)}
                small
              />
            );
          })}
        </div>
      </Card>

      {/* Issues list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-success-500 mx-auto mb-2" />
            <p className="text-sm text-surface-500">No issues found matching the current filters.</p>
          </Card>
        ) : (
          filtered.map((issue, idx) => {
            const cfg = SEVERITY_CONFIG[issue.severity];
            const Icon = ICONS[issue.category.replace(" ", "")] || Bug;
            const expanded = expandedIssues.has(idx);
            return (
              <Card key={idx} className={clsx("overflow-hidden", cfg.borderColor)}>
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  onClick={() => toggleIssue(idx)}
                >
                  <div className={clsx("shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", cfg.bgColor)}>
                    <Icon className={clsx("w-4.5 h-4.5", cfg.textColor)} style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx("text-xs font-medium px-1.5 py-0.5 rounded", cfg.bgColor, cfg.textColor)}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-surface-400">{issue.category}</span>
                      {issue.rule_id && <span className="text-xs text-surface-400 font-mono">{issue.rule_id}</span>}
                      {issue.line_start && (
                        <span className="text-xs text-surface-400">L{issue.line_start}{issue.line_end && issue.line_end !== issue.line_start ? `-${issue.line_end}` : ""}</span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-surface-800 dark:text-surface-200 mt-1">{issue.title}</h4>
                  </div>
                  {expanded ? <ChevronDown className="w-4 h-4 text-surface-400 shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-surface-400 shrink-0 mt-1" />}
                </div>

                {expanded && (
                  <div className="px-4 pb-4 animate-fade-in">
                    <div className="pl-12 space-y-3">
                      <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">{issue.description}</p>
                      {issue.suggestion && (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 mb-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Suggestion
                          </div>
                          <pre className="text-xs font-mono bg-surface-50 dark:bg-surface-800 rounded-lg p-3 overflow-x-auto text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
                            {issue.suggestion}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Refactored code */}
      {result.refactored_code && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-500" />
              <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300">AI Refactored Code</h4>
            </div>
            <Button variant="secondary" onClick={() => setShowRefactored(!showRefactored)} className="text-xs">
              {showRefactored ? "Hide" : "Show"} Diff
            </Button>
          </div>
          {showRefactored && (
            <div className="mb-3">
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">{result.refactoring_explanation}</p>
              <div className="text-xs font-mono bg-surface-50 dark:bg-surface-800 rounded-lg p-3 border border-surface-200 dark:border-surface-700">
                <DiffView oldCode={""} newCode={result.refactored_code} />
              </div>
            </div>
          )}
          {!showRefactored && (
            <pre className="text-xs font-mono bg-surface-50 dark:bg-surface-800 rounded-lg p-3 overflow-x-auto text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700 max-h-60">
              {result.refactored_code}
            </pre>
          )}
        </Card>
      )}
    </div>
  );
}

function MetricBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-success-500" : score >= 60 ? "bg-warning-500" : score >= 40 ? "bg-orange-500" : "bg-error-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-surface-500">{label}</span>
        <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">{score}</span>
      </div>
      <div className="h-1.5 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function MetricStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-800/50">
      <p className="text-lg font-bold text-surface-800 dark:text-surface-200">{value}</p>
      <p className="text-xs text-surface-400">{label}</p>
    </div>
  );
}

function FilterChip({ label, count, active, onClick, color, small }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border transition-all",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-sm",
        active
          ? "bg-primary-600 text-white border-primary-600"
          : "bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600"
      )}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {label}
      <span className={clsx("text-xs", active ? "opacity-80" : "text-surface-400")}>({count})</span>
    </button>
  );
}

function DiffView({ oldCode, newCode }: { oldCode: string; newCode: string }) {
  const parts = diffWords(oldCode, newCode);
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, idx) => (
        <span
          key={idx}
          className={part.added ? "bg-success-500/20 text-success-600 dark:text-success-400" : part.removed ? "bg-error-500/20 text-error-600 dark:text-error-400 line-through" : ""}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}

function CodeSnapshot({ code, issues, language }: { code: string; issues: ReviewIssue[]; language: string }) {
  const [showAll, setShowAll] = useState(false);
  const lines = code.split("\n");

  // Map line numbers to issues
  const lineIssues: Record<number, ReviewIssue[]> = {};
  issues.forEach((issue) => {
    if (issue.line_start) {
      const start = issue.line_start;
      const end = issue.line_end || start;
      for (let i = start; i <= end; i++) {
        if (!lineIssues[i]) lineIssues[i] = [];
        lineIssues[i].push(issue);
      }
    }
  });

  const visibleLines = showAll ? lines : lines.slice(0, 50);
  const hasMore = lines.length > 50;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-surface-400" />
          <span className="text-sm font-medium text-surface-600 dark:text-surface-300">Code Snapshot</span>
          <span className="text-xs text-surface-400">({language})</span>
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(lineIssues).length > 0 && (
            <span className="text-xs text-surface-400">
              {Object.keys(lineIssues).length} lines flagged
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto bg-surface-950 dark:bg-surface-950 max-h-[500px] overflow-y-auto">
        <pre className="text-xs font-mono leading-relaxed">
          <code>
            {visibleLines.map((line, idx) => {
              const lineNum = idx + 1;
              const flagged = lineIssues[lineNum];
              const maxSeverity = flagged?.reduce((max, i) => {
                const order = ["critical", "high", "medium", "low", "info"];
                return order.indexOf(i.severity) < order.indexOf(max) ? i.severity : max;
              }, "info" as Severity);
              const cfg = maxSeverity ? SEVERITY_CONFIG[maxSeverity as Severity] : null;
              return (
                <div
                  key={idx}
                  className={clsx(
                    "flex hover:bg-surface-900/50 transition-colors",
                    cfg && cfg.bgColor
                  )}
                >
                  <span className="shrink-0 w-12 text-right pr-3 text-surface-600 select-none border-r border-surface-800 mr-3">
                    {lineNum}
                  </span>
                  <span className={clsx("flex-1 pr-4", cfg ? cfg.textColor : "text-surface-300")}>
                    {line || " "}
                  </span>
                  {flagged && (
                    <span className="shrink-0 pr-3 flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: cfg?.color }}
                        title={flagged.map((f) => f.title).join(", ")}
                      />
                    </span>
                  )}
                </div>
              );
            })}
          </code>
        </pre>
        {hasMore && (
          <div className="p-2 text-center border-t border-surface-800">
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-primary-500 hover:underline"
            >
              {showAll ? "Show first 50 lines" : `Show all ${lines.length} lines`}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
