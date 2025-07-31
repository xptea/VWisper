import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SiteHeader } from "@/components/dashboard/sheader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUpdate } from "@/hooks/use-update";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saveHistory, setSaveHistory] = useState(true);
  const [saveAudio, setSaveAudio] = useState(true);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [inputType, setInputType] = useState("text");
  const [settingsPath, setSettingsPath] = useState<string | null>(null);
  const { updateInfo, loading: updateLoading, error: updateError, downloading, checkForUpdates, downloadAndInstallUpdate } = useUpdate();

  useEffect(() => {
    invoke("get_settings").then((settings: any) => {
      setApiKey(settings.groq_api_key || "");
      setSaveHistory(settings.save_history !== false);
      setSaveAudio(settings.save_audio !== false);
      setLoading(false);
    });
    invoke("get_settings_path").then((path) => {
      setSettingsPath(path as string);
    });
    // Check autostart status - for now we'll set it to false since we're not implementing autostart in the frontend
    setAutostartEnabled(false);
  }, []);

  const handleSave = async () => {
    setSaved(false);
    await invoke("save_settings", { groqApiKey: apiKey, saveHistory, saveAudio });
    setSaved(true);
    setInputType("password");
  };

  const handleReset = async () => {
    setSaved(false);
    await invoke("reset_settings");
    setApiKey("");
    setSaveHistory(true);
    setSaveAudio(true);
    setSaved(true);
    setInputType("text");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setInputType("text");
    setSaved(false);
  };

  const handleAutostartToggle = async (enabled: boolean) => {
    try {
      // For now, we'll just update the local state since autostart is handled by the backend
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle autostart:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
              </div>
              <Separator className="my-4" />
              <Card className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">API Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="api-key">Groq API Key</Label>
                      <Input
                        id="api-key"
                        type={inputType}
                        value={apiKey}
                        onChange={handleInputChange}
                        placeholder="Enter your Groq API key"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave} className="flex-1">
                        Save
                      </Button>
                      <Button onClick={handleReset} variant="outline" className="flex-1">
                        Reset
                      </Button>
                    </div>
                    {saved && (
                      <div className="text-sm text-green-600 font-medium">Settings saved successfully!</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>History & Audio Settings</CardTitle>
                  <CardDescription>
                    Control how your transcription history and audio files are saved.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <input
                        id="save-history-toggle"
                        type="checkbox"
                        checked={saveHistory}
                        onChange={e => setSaveHistory(e.target.checked)}
                        className="accent-primary h-4 w-4"
                      />
                      <Label htmlFor="save-history-toggle">Save Transcription History</Label>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        id="save-audio-toggle"
                        type="checkbox"
                        checked={saveAudio}
                        onChange={e => setSaveAudio(e.target.checked)}
                        className="accent-primary h-4 w-4"
                        disabled={!saveHistory}
                      />
                      <Label htmlFor="save-audio-toggle" style={{ color: !saveHistory ? '#888' : undefined }}>
                        Save Audio Files
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Autostart Settings</CardTitle>
                  <CardDescription>
                    Automatically launch VWisper when your system starts up.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <input
                      id="autostart-toggle"
                      type="checkbox"
                      checked={autostartEnabled}
                      onChange={e => handleAutostartToggle(e.target.checked)}
                      className="accent-primary h-4 w-4"
                    />
                    <Label htmlFor="autostart-toggle">Launch VWisper on Startup</Label>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Application Updates</CardTitle>
                  <CardDescription>
                    TESTING: Check for and install the latest version of VWisper.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {updateInfo && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Current Version:</span>
                            <Badge variant="outline">{updateInfo.current_version}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Latest Version:</span>
                            <Badge variant={updateInfo.has_update ? "default" : "outline"}>
                              {updateInfo.latest_version}
                            </Badge>
                          </div>
                        </div>
                        {updateInfo.has_update && (
                          <Badge variant="destructive">Update Available</Badge>
                        )}
                      </div>
                    )}
                    
                    {updateError && (
                      <div className="text-sm text-red-600">
                        Error: {updateError}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={checkForUpdates} 
                        disabled={updateLoading || downloading}
                        variant="outline"
                        className="flex-1"
                      >
                        {updateLoading ? "Checking..." : "Check for Updates"}
                      </Button>
                      {updateInfo?.has_update && updateInfo.download_url && (
                        <Button 
                          onClick={async () => {
                            try {
                              await downloadAndInstallUpdate(updateInfo.download_url!);
                            } catch (error) {
                              console.error("Update failed:", error);
                            }
                          }}
                          disabled={downloading}
                          className="flex-1"
                        >
                          {downloading ? "Downloading..." : "Download & Install"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Settings Information</CardTitle>
                  <CardDescription>
                    Your API key is securely saved in the app's local settings file.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {settingsPath && (
                      <>
                        <div>
                          <span className="font-medium">File Path:</span>{" "}
                          <code className="bg-muted px-1 py-0.5 rounded">{settingsPath}</code>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 