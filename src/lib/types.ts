export type AIProvider = "openai" | "anthropic" | "google" | "deepseek" | "groq";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type IssueCategory = "Security" | "Performance" | "Bug" | "Code Quality" | "Architecture" | "Best Practice" | "Maintainability" | "Dependency";

export interface ReviewIssue {
  id?: string;
  review_id?: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  description: string;
  line_start: number | null;
  line_end: number | null;
  suggestion: string;
  rule_id: string;
}

export interface ReviewMetrics {
  complexity: number;
  maintainability: number;
  security_score: number;
  performance_score: number;
  code_quality_score: number;
  estimated_loc: number;
  duplicate_blocks: number;
  code_smells: number;
}

export interface ReviewResult {
  score: number;
  summary: string;
  issues: ReviewIssue[];
  metrics: ReviewMetrics;
  refactored_code: string | null;
  refactoring_explanation: string;
  provider?: string;
  model?: string;
}

export interface Review {
  id: string;
  user_id: string;
  title: string;
  language: string;
  provider: string;
  model: string;
  code: string;
  result: ReviewResult | null;
  score: number;
  status: string;
  created_at: string;
}

export interface ChatMessage {
  id?: string;
  user_id?: string;
  review_id?: string | null;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  created_at?: string;
}

export interface ApiKey {
  id?: string;
  user_id?: string;
  provider: AIProvider;
  encrypted_key: string;
  is_active: boolean;
  created_at?: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string;
  default_provider: AIProvider;
  theme: "dark" | "light";
}

export const PROVIDERS: { id: AIProvider; name: string; models: string[]; envVar: string; docsUrl: string }[] = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"], envVar: "OPENAI_API_KEY", docsUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic Claude", models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"], envVar: "ANTHROPIC_API_KEY", docsUrl: "https://console.anthropic.com/settings/keys" },
  { id: "google", name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"], envVar: "GOOGLE_API_KEY", docsUrl: "https://aistudio.google.com/apikey" },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"], envVar: "DEEPSEEK_API_KEY", docsUrl: "https://platform.deepseek.com/api_keys" },
  { id: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"], envVar: "GROQ_API_KEY", docsUrl: "https://console.groq.com/keys" },
];

export const LANGUAGES: { id: string; name: string; monacoId: string }[] = [
  { id: "typescript", name: "TypeScript", monacoId: "typescript" },
  { id: "javascript", name: "JavaScript", monacoId: "javascript" },
  { id: "python", name: "Python", monacoId: "python" },
  { id: "java", name: "Java", monacoId: "java" },
  { id: "csharp", name: "C#", monacoId: "csharp" },
  { id: "go", name: "Go", monacoId: "go" },
  { id: "rust", name: "Rust", monacoId: "rust" },
  { id: "c", name: "C", monacoId: "c" },
  { id: "cpp", name: "C++", monacoId: "cpp" },
  { id: "php", name: "PHP", monacoId: "php" },
  { id: "ruby", name: "Ruby", monacoId: "ruby" },
  { id: "kotlin", name: "Kotlin", monacoId: "kotlin" },
  { id: "swift", name: "Swift", monacoId: "swift" },
  { id: "sql", name: "SQL", monacoId: "sql" },
  { id: "html", name: "HTML", monacoId: "html" },
  { id: "css", name: "CSS", monacoId: "css" },
  { id: "json", name: "JSON", monacoId: "json" },
  { id: "markdown", name: "Markdown", monacoId: "markdown" },
  { id: "yaml", name: "YAML", monacoId: "yaml" },
  { id: "bash", name: "Bash/Shell", monacoId: "shell" },
];

export const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bgColor: string; borderColor: string; textColor: string }> = {
  critical: { label: "Critical", color: "#dc2626", bgColor: "bg-red-500/10", borderColor: "border-red-500/30", textColor: "text-red-400" },
  high: { label: "High", color: "#ea580c", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/30", textColor: "text-orange-400" },
  medium: { label: "Medium", color: "#ca8a04", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/30", textColor: "text-yellow-400" },
  low: { label: "Low", color: "#2563eb", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/30", textColor: "text-blue-400" },
  info: { label: "Info", color: "#0891b2", bgColor: "bg-cyan-500/10", borderColor: "border-cyan-500/30", textColor: "text-cyan-400" },
};

export const CATEGORY_ICONS: Record<IssueCategory, string> = {
  Security: "ShieldAlert",
  Performance: "Gauge",
  Bug: "Bug",
  "Code Quality": "Code2",
  Architecture: "Building2",
  "Best Practice": "CheckCircle2",
  Maintainability: "Wrench",
  Dependency: "Package",
};
