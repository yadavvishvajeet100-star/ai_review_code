import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  message: string;
  provider: string;
  model?: string;
  apiKey?: string;
  context?: string;
  history?: { role: string; content: string }[];
}

const SYSTEM_PROMPT = `You are an expert AI coding assistant integrated into a code review platform. You help developers understand, optimize, and fix their code. You can:
- Explain functions and code blocks line by line
- Suggest optimizations and refactoring following SOLID principles
- Find hidden bugs and edge cases
- Generate unit tests
- Generate documentation
- Rewrite code following clean code practices

When showing code, always use proper markdown code blocks with the language tag. Be concise but thorough.`;

const PROVIDER_CONFIG: Record<string, { url: string; models: string[]; headerFn: (key: string) => Record<string, string>; bodyFn: (model: string, messages: any[]) => any; parseFn: (data: any) => string }> = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages) => ({ model, messages, temperature: 0.3, max_tokens: 4000, stream: false }),
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    headerFn: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    bodyFn: (model, messages) => ({ model, max_tokens: 4000, temperature: 0.3, system: SYSTEM_PROMPT, messages: messages.filter(m => m.role !== "system") }),
    parseFn: (data) => data.content?.[0]?.text || "",
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    headerFn: () => ({}),
    bodyFn: (model, messages) => {
      const userMsg = messages.find(m => m.role === "user");
      return { contents: [{ parts: [{ text: userMsg?.content || "" }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 4000 } };
    },
    parseFn: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || "",
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages) => ({ model, messages, temperature: 0.3, max_tokens: 4000 }),
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages) => ({ model, messages, temperature: 0.3, max_tokens: 4000 }),
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
  },
};

function getProviderUrl(provider: string, model: string, apiKey: string): string {
  if (provider === "google") {
    return `${PROVIDER_CONFIG.google.url}/${model}:generateContent?key=${apiKey}`;
  }
  return PROVIDER_CONFIG[provider]?.url || PROVIDER_CONFIG.openai.url;
}

async function callAI(provider: string, model: string, apiKey: string, messages: any[], timeoutMs = 60000): Promise<string> {
  const config = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.openai;
  const url = getProviderUrl(provider, model, apiKey);
  const headers = { "Content-Type": "application/json", ...config.headerFn(apiKey) };
  const body = config.bodyFn(model, messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI provider error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return config.parseFn(data);
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, provider, model, apiKey, context, history }: ChatRequest = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key required. Configure your provider API key in Settings." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const useProvider = provider || "openai";
    const config = PROVIDER_CONFIG[useProvider] || PROVIDER_CONFIG.openai;
    const useModel = model || config.models[0];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(context ? [{ role: "system", content: `Code context:\n\n\`\`\`\n${context}\n\`\`\`` }] : []),
      ...(history || []),
      { role: "user", content: message },
    ];

    const content = await callAI(useProvider, useModel, apiKey, messages);

    return new Response(JSON.stringify({ content, provider: useProvider, model: useModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
