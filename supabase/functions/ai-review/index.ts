import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewRequest {
  code: string;
  language: string;
  provider: string;
  model?: string;
  apiKey?: string;
  reviewId?: string;
  images?: string[];
  imageMode?: boolean;
}

const SYSTEM_PROMPT = `You are an elite AI code reviewer with expertise in software engineering, security, performance, and clean code principles. Analyze the provided code thoroughly and return a structured JSON response.

Analyze for ALL of the following:
1. Bug Detection - logic errors, off-by-one, null dereferences, unhandled promises
2. Security - injection, XSS, CSRF, hardcoded secrets, weak auth, path traversal, RCE
3. Performance - nested loops, memory leaks, N+1 queries, blocking operations, expensive algorithms
4. Code Quality - naming, readability, SOLID principles, clean code, magic numbers, dead code
5. Architecture - scalability, coupling, separation of concerns, design patterns
6. Best Practices - error handling, edge cases, type safety, immutability, concurrency
7. Maintainability - complexity, duplication, documentation quality, test coverage
8. Dependencies - vulnerable packages, outdated versions, unnecessary deps

Return ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "summary": "<2-3 sentence executive summary>",
  "issues": [
    {
      "category": "Security|Performance|Bug|Code Quality|Architecture|Best Practice|Maintainability|Dependency",
      "severity": "critical|high|medium|low|info",
      "title": "<short title>",
      "description": "<detailed explanation>",
      "line_start": <line number or null>,
      "line_end": <line number or null>,
      "suggestion": "<code suggestion or fix>",
      "rule_id": "<rule identifier like S101, PERF-1, etc>"
    }
  ],
  "metrics": {
    "complexity": <number>,
    "maintainability": <number 0-100>,
    "security_score": <number 0-100>,
    "performance_score": <number 0-100>,
    "code_quality_score": <number 0-100>,
    "estimated_loc": <number>,
    "duplicate_blocks": <number>,
    "code_smells": <number>
  },
  "refactored_code": "<full improved version of the code, or null if no changes needed>",
  "refactoring_explanation": "<explanation of changes made in refactored code>"
}

Be precise with line numbers. Only include real issues — no false positives. If the code is already good, say so. If you are reviewing code from images, transcribe the visible code first, then review it. Line numbers refer to the visible code.`;

interface ProviderConfig {
  url: string;
  models: string[];
  headerFn: (key: string) => Record<string, string>;
  bodyFn: (model: string, messages: any[], images?: string[]) => any;
  parseFn: (data: any) => string;
  supportsVision: boolean;
}

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-preview", "o1-mini"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages, images) => {
      const userMsg = messages.find((m) => m.role === "user");
      let content: any = userMsg?.content || "";
      if (images && images.length > 0) {
        content = [
          { type: "text", text: userMsg?.content || "" },
          ...images.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } })),
        ];
      }
      return {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      };
    },
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
    supportsVision: true,
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    headerFn: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    bodyFn: (model, messages, images) => {
      const userMsg = messages.find((m) => m.role === "user");
      let content: any = userMsg?.content || "";
      if (images && images.length > 0) {
        content = [
          ...images.map((url) => ({
            type: "image",
            source: { type: "base64", media_type: url.startsWith("data:image/png") ? "image/png" : url.startsWith("data:image/webp") ? "image/webp" : "image/jpeg", data: url.split(",")[1] || "" },
          })),
          { type: "text", text: userMsg?.content || "" },
        ];
      }
      return {
        model,
        max_tokens: 8000,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      };
    },
    parseFn: (data) => data.content?.[0]?.text || "",
    supportsVision: true,
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash-exp"],
    headerFn: () => ({}),
    bodyFn: (model, messages, images) => {
      const userMsg = messages.find((m) => m.role === "user");
      const parts: any[] = [{ text: userMsg?.content || "" }];
      if (images && images.length > 0) {
        for (const url of images) {
          const match = url.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (match) {
            parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
          }
        }
      }
      return {
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000, responseMimeType: "application/json" },
      };
    },
    parseFn: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    supportsVision: true,
  },
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages) => ({ model, messages, temperature: 0.2, max_tokens: 8000, response_format: { type: "json_object" } }),
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
    supportsVision: false,
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"],
    headerFn: (key) => ({ Authorization: `Bearer ${key}` }),
    bodyFn: (model, messages) => ({ model, messages, temperature: 0.2, max_tokens: 8000, response_format: { type: "json_object" } }),
    parseFn: (data) => data.choices?.[0]?.message?.content || "",
    supportsVision: false,
  },
};

function getProviderUrl(provider: string, model: string, apiKey: string): string {
  if (provider === "google") {
    return `${PROVIDER_CONFIG.google.url}/${model}:generateContent?key=${apiKey}`;
  }
  return PROVIDER_CONFIG[provider]?.url || PROVIDER_CONFIG.openai.url;
}

async function callAI(
  provider: string,
  model: string,
  apiKey: string,
  messages: any[],
  images?: string[],
  timeoutMs = 90000
): Promise<string> {
  const config = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.openai;
  const url = getProviderUrl(provider, model, apiKey);
  const headers = { "Content-Type": "application/json", ...config.headerFn(apiKey) };
  const body = config.bodyFn(model, messages, images);

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

async function callWithFallback(
  provider: string,
  model: string,
  apiKey: string,
  messages: any[],
  images?: string[]
): Promise<{ content: string; usedProvider: string; usedModel: string }> {
  const config = PROVIDER_CONFIG[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);
  const useModel = model || config.models[0];

  try {
    const content = await callAI(provider, useModel, apiKey, messages, images);
    return { content, usedProvider: provider, usedModel: useModel };
  } catch (err) {
    // Fallback to openai if different provider configured
    if (provider !== "openai") {
      try {
        const content = await callAI("openai", "gpt-4o-mini", apiKey, messages, images);
        return { content, usedProvider: "openai", usedModel: "gpt-4o-mini" };
      } catch { /* ignore fallback error, throw original */ }
    }
    throw err;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { code, language, provider, model, apiKey, images, imageMode }: ReviewRequest = await req.json();
    const useImageMode = !!imageMode;
    const useImages = useImageMode ? (images || []) : [];

    if (useImageMode && useImages.length === 0) {
      return new Response(JSON.stringify({ error: "At least one image is required in image mode." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!useImageMode && (!code || !language)) {
      return new Response(JSON.stringify({ error: "Code and language are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key required. Configure your provider API key in Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useProvider = provider || "openai";
    const providerCfg = PROVIDER_CONFIG[useProvider];

    if (useImageMode && providerCfg && !providerCfg.supportsVision) {
      return new Response(JSON.stringify({
        error: `The ${useProvider} provider does not support image input. Please select OpenAI, Anthropic, or Google to review code images.`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userPrompt = useImageMode
      ? `Language hint: ${language || "unknown"}\n\nThe following image(s) contain code. Transcribe the visible code, then review it according to the criteria above. Return the review as JSON. If multiple images are provided, treat them as parts of the same codebase.`
      : `Language: ${language}\n\nCode to review:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn the review as JSON.`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ];

    const { content, usedProvider, usedModel } = await callWithFallback(useProvider, model || "", apiKey, messages, useImages);

    let parsed;
    try {
      // Strip markdown code fences if present
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return raw content with a note
      return new Response(JSON.stringify({ error: "AI returned non-JSON response", raw: content }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track usage
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userToken = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabase.auth.getUser(userToken);
        if (userData.user) {
          await supabase.from("ai_usage").insert({
            user_id: userData.user.id,
            provider: usedProvider,
            model: usedModel,
            tokens_in: Math.ceil((code?.length || 0) / 4) + useImages.reduce((s, i) => s + Math.ceil(i.length / 4), 0),
            tokens_out: Math.ceil(content.length / 4),
          });
        }
      }
    } catch { /* usage tracking is best-effort */ }

    return new Response(JSON.stringify({ ...parsed, provider: usedProvider, model: usedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
