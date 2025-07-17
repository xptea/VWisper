
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Key, Play, Zap, History, Apple, Brain } from "lucide-react";
import { toast } from "sonner";

interface AppSettings {
  groq_api_key?: string;
  auto_start: boolean;
  save_history: boolean;
  shortcut_enabled: boolean;
  sample_rate: number;
  volume_threshold: number;
  theme: string;
  has_seen_splash: boolean;
}

function getPlatform() {
  if (typeof window !== "undefined" && navigator.platform.includes("Mac")) {
    return "mac";
  }
  if (typeof window !== "undefined" && navigator.platform.match(/Win/)) {
    return "windows";
  }
  return "linux";
}

function getDefaultShortcut() {
  const platform = getPlatform();
  if (platform === "mac") return "Control";
  if (platform === "windows") return "Right Ctrl";
  return "Right Ctrl";
}

function PlatformIcon() {
  const platform = getPlatform();
  if (platform === "mac") return <Apple className="w-5 h-5 text-muted-foreground" />;
  if (platform === "windows") return (
    <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" aria-label="Windows">
      <rect x="2" y="3" width="20" height="18" rx="2" fill="#00ADEF" />
      <rect x="2" y="3" width="9.5" height="8.5" fill="#fff" />
      <rect x="12.5" y="3" width="9.5" height="8.5" fill="#fff" />
      <rect x="2" y="11.5" width="9.5" height="8.5" fill="#fff" />
      <rect x="12.5" y="11.5" width="9.5" height="8.5" fill="#fff" />
    </svg>
  );
  // Linux fallback SVG
  return (
    <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" aria-label="Linux">
      <ellipse cx="12" cy="12" rx="10" ry="10" fill="#333" />
      <ellipse cx="9" cy="10" rx="1.2" ry="2" fill="#fff" />
      <ellipse cx="15" cy="10" rx="1.2" ry="2" fill="#fff" />
      <ellipse cx="9" cy="10.5" rx="0.4" ry="0.7" fill="#333" />
      <ellipse cx="15" cy="10.5" rx="0.4" ry="0.7" fill="#333" />
      <ellipse cx="12" cy="16" rx="3" ry="1.2" fill="#fff" />
    </svg>
  );
}

const whisperModels = [
  {
    id: "whisper-large-v3",
    name: "Whisper Large v3",
    cost: "$0.111",
    language: "Multilingual",
    transcription: "Yes",
    translation: "Yes",
    speed: "189",
    errorRate: "10.3%",
    description: "High accuracy, multilingual support",
  },
  {
    id: "whisper-large-v3-turbo",
    name: "Whisper Large v3 Turbo",
    cost: "$0.4",
    language: "Multilingual",
    transcription: "Yes",
    translation: "No",
    speed: "216",
    errorRate: "12%",
    description: "Fast, multilingual transcription",
  },
  {
    id: "distil-whisper-large-v3-en",
    name: "Distil Whisper Large v3 (English)",
    cost: "$0.2",
    language: "English only",
    transcription: "Yes",
    translation: "No",
    speed: "250",
    errorRate: "13%",
    description: "Fastest, English-only transcription",
  },
];

export function Settings() {
  const [groqApiKey, setGroqApiKey] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [saveTranscriptions, setSaveTranscriptions] = useState(true);
  const [shortcutEnabled, setShortcutEnabled] = useState(true);
  const [selectedModel, setSelectedModel] = useState("distil-whisper-large-v3-en");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("load_settings");
        setGroqApiKey(settings.groq_api_key || "");
        setAutoStart(settings.auto_start || false);
        setSaveTranscriptions(settings.save_history !== false); // Default to true
        setShortcutEnabled(settings.shortcut_enabled !== false); // Default to true
        setSelectedModel("distil-whisper-large-v3-en"); // Default model
      } catch (error) {
        console.error("Failed to load settings:", error);
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Helper to save and toast
  const saveSetting = async (partial: any) => {
    try {
      const newSettings = {
        groq_api_key: partial.groq_api_key ?? groqApiKey,
        auto_start: partial.auto_start ?? autoStart,
        save_history: partial.save_transcriptions ?? saveTranscriptions,
        shortcut_enabled: partial.shortcut_enabled ?? shortcutEnabled,
      };
      
      await invoke("save_settings", { settings: newSettings });
      toast.success("Settings updated");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const testApiKey = async () => {
    if (!groqApiKey) {
      toast.error("Please enter an API key first");
      return;
    }

    try {
      const isValid = await invoke("test_groq_api_key", { apiKey: groqApiKey });
      if (isValid) {
        toast.success("API key is valid!");
      } else {
        toast.error("API key is invalid");
      }
    } catch (error) {
      toast.error("Failed to test API key");
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your VWisper application preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* API Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groq-api" className="text-sm font-medium">
                  Groq API Key
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enter your Groq API key to enable speech-to-text functionality
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    id="groq-api"
                    type="password"
                    placeholder="sk-..."
                    value={groqApiKey}
                    onChange={e => setGroqApiKey(e.target.value)}
                    onBlur={async () => {
                      await saveSetting({ groq_api_key: groqApiKey });
                    }}
                    autoComplete="off"
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={testApiKey}
                    disabled={loading || !groqApiKey}
                  >
                    Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* App Behavior Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                App Behavior
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="auto-start"
                  checked={autoStart}
                  onCheckedChange={async checked => {
                    setAutoStart(checked === true);
                    await saveSetting({ auto_start: checked === true });
                  }}
                  disabled={loading}
                />
                <div className="space-y-1">
                  <Label htmlFor="auto-start" className="text-sm font-medium">
                    Start App at Launch
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically start VWisper when system boots
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 opacity-50 cursor-not-allowed">
                <Checkbox
                  id="show-dashboard"
                  checked={true}
                  onCheckedChange={() => {}}
                  disabled={true}
                />
                <div className="space-y-1">
                  <Label htmlFor="show-dashboard" className="text-sm font-medium cursor-not-allowed">
                    Show Dashboard on App Launch
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Open dashboard automatically when app starts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Storage Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="save-transcriptions"
                  checked={saveTranscriptions}
                  onCheckedChange={async checked => {
                    setSaveTranscriptions(checked === true);
                    await saveSetting({ save_transcriptions: checked === true });
                  }}
                  disabled={loading}
                />
                <div className="space-y-1">
                  <Label htmlFor="save-transcriptions" className="text-sm font-medium">
                    Save Transcriptions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Store all transcriptions locally for history and analytics
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Model Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                AI Model Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Whisper Model
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select the AI model for speech transcription
                </p>
              </div>
              
              <div className="space-y-3">
                {whisperModels.map((model) => (
                  <div key={model.id} className="flex items-center gap-3 opacity-50 cursor-not-allowed">
                    <Checkbox
                      id={model.id}
                      checked={model.id === selectedModel}
                      onCheckedChange={() => {}}
                      disabled={true}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={model.id} className="text-sm font-medium cursor-not-allowed">
                          {model.name}
                        </Label>
                        <span className="text-xs text-muted-foreground">{model.cost}/hr</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{model.description}</p>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>Speed: {model.speed}</div>
                        <div>Error: {model.errorRate}</div>
                        <div>Lang: {model.language}</div>
                        <div>Trans: {model.transcription}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Global Shortcut Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Global Shortcut
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shortcut" className="text-sm font-medium">
                  Recording Shortcut
                </Label>
                <p className="text-sm text-muted-foreground">
                  Global hotkey to start/stop recording
                </p>
                <div className="flex items-center gap-2">
                  <PlatformIcon />
                  <Input
                    id="shortcut"
                    value={getDefaultShortcut()}
                    disabled={true}
                    placeholder={getDefaultShortcut()}
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="shortcut-enabled"
                    checked={shortcutEnabled}
                    onCheckedChange={async checked => {
                      setShortcutEnabled(checked === true);
                      await saveSetting({ shortcut_enabled: checked === true });
                    }}
                    disabled={loading}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="shortcut-enabled" className="text-sm font-medium">
                      Enable Global Shortcut
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow global hotkey to control recording
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Settings;
