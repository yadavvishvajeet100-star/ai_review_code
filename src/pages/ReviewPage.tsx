import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  ScanLine, Play, Loader2, AlertCircle, Code2, Settings2,
  ChevronRight, FileCode, Sparkles, Trash2, Upload, ImageIcon, X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  LANGUAGES, PROVIDERS, type AIProvider,
  type ReviewResult, type ReviewIssue,
} from "../lib/types";
import { Button, Select, Card, Spinner, EmptyState } from "../components/ui";
import { ReviewResults } from "../components/ReviewResults";
import { clsx } from "clsx";

const SAMPLE_CODE = `// Paste your code here or start typing...
function processUsers(users) {
  let result = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].age > 18) {
      result.push({
        name: users[i].name,
        email: users[i].email,
        id: users[i].id
      });
    }
  }
  return result;
}`;

export function ReviewPage() {
  const { user, profile } = useAuth();
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("typescript");
  const [provider, setProvider] = useState<AIProvider>(profile?.default_provider || "openai");
  const [model, setModel] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imageNames, setImageNames] = useState<string[]>([]);
  const [imageMode, setImageMode] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const editorRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const monacoLang = LANGUAGES.find((l) => l.id === language)?.monacoId || "plaintext";
  const providerConfig = PROVIDERS.find((p) => p.id === provider);

  async function handleEditorMount(editor: any) {
    editorRef.current = editor;
  }

  function handleClearCode() {
    setCode("");
    setResult(null);
    setError(null);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const MAX_SIZE = 8 * 1024 * 1024;

    for (const file of files) {
      if (!validTypes.includes(file.type)) {
        setUploadError(`Unsupported file type: ${file.name}. Use PNG, JPEG, WebP, or GIF.`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        setUploadError(`File too large: ${file.name}. Max 8MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setImages((prev) => [...prev, dataUrl]);
        setImageNames((prev) => [...prev, file.name]);
      };
      reader.onerror = () => setUploadError(`Failed to read ${file.name}.`);
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImageNames((prev) => prev.filter((_, i) => i !== idx));
  }

  const runReview = useCallback(async () => {
    if (!imageMode && !code.trim()) {
      setError("Please enter some code to review.");
      return;
    }
    if (imageMode && images.length === 0) {
      setError("Please upload at least one code image to review.");
      return;
    }
    setError(null);
    setReviewing(true);
    setResult(null);

    try {
      // Get API key from database or use the one provided
      let keyToUse = apiKey;
      if (!keyToUse) {
        const { data: keyData } = await supabase
          .from("api_keys")
          .select("encrypted_key")
          .eq("user_id", user?.id)
          .eq("provider", provider)
          .eq("is_active", true)
          .maybeSingle();

        if (keyData?.encrypted_key) {
          keyToUse = keyData.encrypted_key;
        }
      }

      if (!keyToUse) {
        setShowKeyInput(true);
        setReviewing(false);
        setError(`No API key found for ${providerConfig?.name}. Please add your key in Settings or enter it below.`);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          code,
          language,
          provider,
          model,
          apiKey: keyToUse,
          images: imageMode ? images : [],
          imageMode,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Review failed (${response.status})`);
      }

      const data: ReviewResult = await response.json();
      setResult(data);

      // Save review to database
      const { data: reviewRecord } = await supabase.from("reviews").insert({
        user_id: user?.id,
        title: imageMode ? `Image review (${images.length} img)` : `${language} review`,
        language,
        provider: data.provider || provider,
        model: data.model || model,
        code: imageMode ? `[Image review: ${imageNames.join(", ")}]` : code,
        result: data,
        score: data.score,
        status: "completed",
      }).select().single();

      // Save issues
      if (reviewRecord && data.issues?.length > 0) {
        await supabase.from("review_issues").insert(
          data.issues.map((issue: ReviewIssue) => ({
            review_id: reviewRecord.id,
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            line_start: issue.line_start,
            line_end: issue.line_end,
            suggestion: issue.suggestion,
            rule_id: issue.rule_id,
          }))
        );
      }

      // Save API key for future use if provided inline
      if (apiKey) {
        await supabase.from("api_keys").upsert({
          user_id: user?.id,
          provider,
          encrypted_key: apiKey,
          is_active: true,
        }, { onConflict: "user_id,provider" });
        setApiKey("");
        setShowKeyInput(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  }, [code, language, provider, model, apiKey, user, imageMode, images, imageNames]);

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-surface-400 mb-1">
            <span>Review</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-surface-600 dark:text-surface-300">New Review</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
            <ScanLine className="w-6 h-6 text-primary-500" />
            AI Code Review
          </h1>
        </div>
        <Button onClick={runReview} disabled={reviewing}>
          {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {reviewing ? "Reviewing..." : "Run Review"}
        </Button>
      </div>

      {/* Config bar */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-100 dark:bg-surface-800">
            <button
              onClick={() => { setImageMode(false); setResult(null); setError(null); }}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                !imageMode
                  ? "bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
            <button
              onClick={() => { setImageMode(true); setResult(null); setError(null); }}
              className={clsx(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                imageMode
                  ? "bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm"
                  : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
              )}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Image
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-surface-400" />
            <Select value={language} onChange={setLanguage} className="w-40">
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-surface-400" />
            <Select value={provider} onChange={(v) => { setProvider(v as AIProvider); setModel(""); }} className="w-44">
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>

          <Select value={model} onChange={setModel} className="w-48">
            <option value="">Default Model</option>
            {providerConfig?.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowKeyInput(!showKeyInput)} className="text-xs">
              <Settings2 className="w-3.5 h-3.5" />
              API Key
            </Button>
          </div>
        </div>

        {showKeyInput && (
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-800 animate-fade-in">
            <label className="block text-xs font-medium text-surface-500 mb-1">
              {providerConfig?.name} API Key (stored encrypted, used for this provider)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${providerConfig?.name} API key`}
                className="input flex-1"
              />
              <span className="text-xs text-surface-400 self-center">
                Get key: <a href={providerConfig?.docsUrl} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">{providerConfig?.docsUrl}</a>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-error-500/10 border border-error-500/30 text-error-500 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor or Image Uploader */}
        {imageMode ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-surface-400" />
                <span className="text-sm font-medium text-surface-600 dark:text-surface-300">Code Images</span>
              </div>
              <span className="text-xs text-surface-400">{images.length} image{images.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="p-4 space-y-4">
              {/* Upload zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-surface-300 dark:border-surface-700 rounded-xl p-8 text-center hover:border-primary-500 hover:bg-primary-500/5 transition-all group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                    <Upload className="w-6 h-6 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      Upload code screenshots
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      PNG, JPEG, WebP, or GIF — up to 8MB each
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-error-500/10 border border-error-500/30 text-error-500 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Image previews */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700">
                      <img src={img} alt={imageNames[idx]} className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                        <span className="text-xs text-white truncate max-w-[70%]">{imageNames[idx]}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                          className="w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-error-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {images.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/30 text-xs text-surface-400">
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span>Upload screenshots of your code and the AI will analyze them visually.</span>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-surface-400" />
                <span className="text-sm font-medium text-surface-600 dark:text-surface-300">Source Code</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-400">{code.split("\n").length} lines</span>
                <button
                  onClick={handleClearCode}
                  disabled={!code}
                  className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-error-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Clear source code"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>
            <div className="h-[600px] monaco-container">
              <Editor
                height="100%"
                language={monacoLang}
                value={code}
                onChange={(v) => setCode(v || "")}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  minimap: { enabled: true, scale: 1 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                  padding: { top: 12, bottom: 12 },
                }}
              />
            </div>
          </Card>
        )}

        {/* Results */}
        <div className="space-y-4">
          {reviewing && !result && (
            <Card className="p-8 flex flex-col items-center justify-center h-[600px]">
              <Spinner size={40} />
              <p className="mt-4 text-sm text-surface-500">AI is analyzing your code...</p>
              <p className="text-xs text-surface-400 mt-1">This may take 10-30 seconds</p>
            </Card>
          )}

          {!reviewing && !result && !error && (
            <Card className="h-[600px]">
              <EmptyState
                icon={<ScanLine className="w-12 h-12" />}
                title="No review yet"
                description="Paste your code and click Run Review to get an AI-powered analysis with security, performance, and quality insights."
              />
            </Card>
          )}

          {result && <ReviewResults result={result} code={imageMode ? "" : code} language={language} />}
        </div>
      </div>
    </div>
  );
}
