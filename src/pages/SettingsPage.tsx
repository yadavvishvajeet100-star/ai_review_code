import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, Key, Plus, Trash2, Check, AlertCircle,
  Shield, User, Eye, EyeOff, ExternalLink,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { PROVIDERS, type AIProvider, type ApiKey } from "../lib/types";
import { Card, Button, Input, Spinner, Badge } from "../components/ui";
import { clsx } from "clsx";

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState("");
  const [keyProvider, setKeyProvider] = useState<AIProvider>("openai");
  const [showKey, setShowKey] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [defaultProvider, setDefaultProvider] = useState<AIProvider>(profile?.default_provider || "openai");
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setKeys((data as ApiKey[]) || []);
      setLoading(false);
    })();
  }, [user]);

  async function addKey() {
    if (!newKey.trim() || !user) return;
    setMessage(null);
    const { data, error } = await supabase
      .from("api_keys")
      .upsert({
        user_id: user.id,
        provider: keyProvider,
        encrypted_key: newKey.trim(),
        is_active: true,
      }, { onConflict: "user_id,provider" })
      .select()
      .single();

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setKeys((prev) => {
      const filtered = prev.filter((k) => k.provider !== keyProvider);
      return [data as ApiKey, ...filtered];
    });
    setNewKey("");
    setMessage({ type: "success", text: `API key for ${PROVIDERS.find(p => p.id === keyProvider)?.name} saved successfully.` });
  }

  async function deleteKey(id: string) {
    await supabase.from("api_keys").delete().eq("id", id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, default_provider: defaultProvider })
      .eq("id", user.id);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      await refreshProfile();
      setMessage({ type: "success", text: "Profile updated." });
    }
    setSavingProfile(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={32} /></div>;
  }

  const configuredProviders = new Set(keys.map((k) => k.provider));

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-6 flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-primary-500" />
        Settings
      </h1>

      {message && (
        <div className={clsx(
          "flex items-center gap-2 p-3 mb-4 rounded-lg text-sm animate-fade-in",
          message.type === "success" ? "bg-success-500/10 border border-success-500/30 text-success-500" : "bg-error-500/10 border border-error-500/30 text-error-500"
        )}>
          {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Profile */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-surface-800 dark:text-surface-200">Profile</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">Display Name</label>
            <Input value={displayName} onChange={setDisplayName} placeholder="Your name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">Default AI Provider</label>
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value as AIProvider)}
              className="input cursor-pointer"
            >
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? <Spinner size={16} /> : <Check className="w-4 h-4" />}
            Save Profile
          </Button>
        </div>
      </Card>

      {/* API Keys */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-surface-800 dark:text-surface-200">AI Provider API Keys</h3>
        </div>
        <p className="text-sm text-surface-500 mb-4">
          Add your own API keys for each AI provider. Keys are stored securely and used to power code reviews and chat.
        </p>

        {/* Existing keys */}
        <div className="space-y-2 mb-4">
          {keys.map((key) => {
            const provider = PROVIDERS.find((p) => p.id === key.provider);
            return (
              <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-primary-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-700 dark:text-surface-300">{provider?.name || key.provider}</p>
                    <p className="text-xs text-surface-400 font-mono">
                      {key.encrypted_key.slice(0, 6)}••••••••{key.encrypted_key.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-success-500/10 text-success-500">
                    <Check className="w-3 h-3" /> Active
                  </Badge>
                  <Button variant="ghost" onClick={() => deleteKey(key.id!)} className="px-2 text-surface-400 hover:text-error-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new key */}
        <div className="p-4 rounded-lg border border-dashed border-surface-300 dark:border-surface-700">
          <h4 className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-3">Add API Key</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-surface-500 mb-1">Provider</label>
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value as AIProvider)}
                className="input cursor-pointer"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-surface-500 mb-1">
                API Key
                <a
                  href={PROVIDERS.find(p => p.id === keyProvider)?.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-primary-500 hover:underline inline-flex items-center gap-0.5"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={`Enter your ${PROVIDERS.find(p => p.id === keyProvider)?.name || "provider"} API key...`}
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button onClick={addKey} disabled={!newKey.trim()}>
              <Plus className="w-4 h-4" />
              Save Key
            </Button>
          </div>
        </div>

        {/* Provider status */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/30">
              <div className={clsx(
                "w-2 h-2 rounded-full",
                configuredProviders.has(p.id) ? "bg-success-500" : "bg-surface-300 dark:bg-surface-600"
              )} />
              <span className="text-xs text-surface-600 dark:text-surface-400">{p.name}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Security note */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Security & Privacy</h4>
            <p className="text-sm text-surface-500 mt-1">
              Your API keys are stored in an encrypted database with row-level security. Only you can access your keys.
              Code sent for review is processed by your selected AI provider and is not stored beyond your review history.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
