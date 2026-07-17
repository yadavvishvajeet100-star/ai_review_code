import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquareCode, Send, Loader2, Trash2, User, Bot, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { PROVIDERS, type AIProvider, type ChatMessage } from "../lib/types";
import { Card, Button, Select, Spinner, EmptyState } from "../components/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx } from "clsx";

const QUICK_PROMPTS = [
  "Explain this function line by line",
  "How can I optimize this code?",
  "Rewrite using SOLID principles",
  "Find hidden bugs and edge cases",
  "Generate unit tests for this code",
  "Generate documentation for this code",
];

export function ChatPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider>(profile?.default_provider || "openai");
  const [model, setModel] = useState("");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      setMessages((data as ChatMessage[]) || []);
      setLoadingHistory(false);
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: msg, provider };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Get API key
      const { data: keyData } = await supabase
        .from("api_keys")
        .select("encrypted_key")
        .eq("user_id", user?.id)
        .eq("provider", provider)
        .eq("is_active", true)
        .maybeSingle();

      if (!keyData?.encrypted_key) {
        setError(`No API key found for ${PROVIDERS.find(p => p.id === provider)?.name}. Add it in Settings.`);
        setLoading(false);
        return;
      }

      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          message: msg,
          provider,
          model,
          apiKey: keyData.encrypted_key,
          context: context || undefined,
          history,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Chat failed (${response.status})`);
      }

      const data = await response.json();
      const assistantMsg: ChatMessage = { role: "assistant", content: data.content, provider: data.provider };

      // Save to DB
      await supabase.from("chat_messages").insert([
        { user_id: user?.id, role: "user", content: msg, provider },
        { user_id: user?.id, role: "assistant", content: data.content, provider: data.provider },
      ]);

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, provider, model, context, user]);

  async function clearChat() {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([]);
  }

  const providerConfig = PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in h-[calc(100vh-3rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
          <MessageSquareCode className="w-6 h-6 text-primary-500" />
          AI Chat with Code
        </h1>
        <div className="flex items-center gap-2">
          <Select value={provider} onChange={(v) => setProvider(v as AIProvider)} className="w-36 text-xs py-1.5">
            {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={model} onChange={setModel} className="w-40 text-xs py-1.5">
            <option value="">Default</option>
            {providerConfig?.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Button variant="ghost" onClick={clearChat} className="text-xs px-2">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Context toggle */}
      <div className="mb-3">
        <Button variant="secondary" onClick={() => setShowContext(!showContext)} className="text-xs">
          {showContext ? "Hide" : "Add"} Code Context
        </Button>
        {showContext && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste code here for the AI to analyze..."
            className="input mt-2 font-mono text-xs h-24 resize-none"
          />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-error-500/10 border border-error-500/30 text-error-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Messages */}
      <Card className="flex-1 overflow-hidden flex flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full"><Spinner size={28} /></div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquareCode className="w-12 h-12" />}
              title="Start a conversation"
              description="Ask the AI to explain, optimize, find bugs, generate tests, or refactor your code."
            />
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={clsx("flex gap-3 animate-fade-in", msg.role === "user" && "flex-row-reverse")}>
                <div className={clsx(
                  "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                  msg.role === "user" ? "bg-primary-500/20 text-primary-500" : "bg-accent-500/20 text-accent-500"
                )}>
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={clsx(
                  "max-w-[80%] rounded-xl p-3",
                  msg.role === "user"
                    ? "bg-primary-600 text-white"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-surface-900 prose-pre:text-surface-100 prose-code:text-primary-500">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-accent-500/20 text-accent-500">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-surface-100 dark:bg-surface-800 rounded-xl p-3">
                <Loader2 className="w-4 h-4 animate-spin text-surface-400" />
              </div>
            </div>
          )}
        </div>

        {/* Quick prompts */}
        {messages.length === 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-primary-500/10 hover:text-primary-500 border border-surface-200 dark:border-surface-700 transition-all"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-surface-200 dark:border-surface-800 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Ask about your code..."
              className="input flex-1"
              disabled={loading}
            />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
