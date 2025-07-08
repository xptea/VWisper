import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';

interface AppSettings {
  sample_rate: number;
  volume_threshold: number;
  groq_api_key?: string;
  shortcut_enabled: boolean;
  auto_start: boolean;
  theme: 'light' | 'dark' | 'system';
  save_history: boolean;
}

interface SettingsProps {
  settings: AppSettings | null;
  updateSettings: (key: keyof AppSettings, value: any) => void;
  testApiKey: () => void;
  openGroqConsole: () => void;
  testing: boolean;
  apiKeyValid: boolean | null;
  showApiKey: boolean;
  setShowApiKey: (show: boolean) => void;
  dataDirectory: string;
  checkingUpdates: boolean;
  updateStatus: { type: 'success' | 'error' | 'update'; message: string } | null;
  checkForUpdates: () => void;
  openGitHubReleases: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  settings,
  updateSettings,
  testApiKey,
  openGroqConsole,
  testing,
  apiKeyValid,
  showApiKey,
  setShowApiKey,
  dataDirectory,
  checkingUpdates,
  updateStatus,
  checkForUpdates,
  openGitHubReleases
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>
              Configure your Groq API key for transcription
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">Groq API Key</Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    id="apiKey"
                    type={showApiKey ? "text" : "password"}
                    value={settings?.groq_api_key || ""}
                    onChange={(e) => updateSettings('groq_api_key', e.target.value)}
                    placeholder="Enter your Groq API key (gsk_...)"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={testApiKey}
                  disabled={testing || !settings?.groq_api_key}
                  variant="outline"
                  size="sm"
                >
                  {testing ? 'Testing...' : 'Test'}
                </Button>
              </div>
              {apiKeyValid !== null && (
                <div className="flex items-center space-x-2 text-sm">
                  {apiKeyValid ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">API key is valid</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">API key is invalid</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {!settings?.groq_api_key && (
              <Alert>
                <AlertDescription>
                  Get your free API key from{' '}
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal text-primary underline"
                    onClick={openGroqConsole}
                  >
                    Groq Console
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Application Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>
              Configure application behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between opacity-50">
              <div className="space-y-0.5">
                <Label className="text-muted-foreground">Global Shortcut (Right Ctrl on windows & linux or Left control on mac)</Label>
                <p className="text-sm text-muted-foreground">
                  Enable global keyboard shortcut for recording
                </p>
              </div>
              <Switch
                checked={true}
                disabled={true}
                className="pointer-events-none"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between opacity-50 pointer-events-none">
              <div className="space-y-0.5">
                <Label>Auto Start with System</Label>
                <p className="text-sm text-muted-foreground">
                  Start VWisper automatically when your computer boots
                </p>
              </div>
              <Switch checked={false} disabled={true} className="pointer-events-none" />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Save Transcription History</Label>
                <p className="text-sm text-muted-foreground">
                  Keep a local history of your transcriptions
                </p>
              </div>
              <Switch
                checked={settings?.save_history ?? true}
                onCheckedChange={(checked) => updateSettings('save_history', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Audio Settings - Grayed Out */}
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="text-muted-foreground">Audio Settings</CardTitle>
            <CardDescription>
              Advanced audio parameters - Custom settings coming soon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pointer-events-none">
            <div className="space-y-2">
              <Label htmlFor="sampleRate" className="text-muted-foreground">Sample Rate (Hz)</Label>
              <Input
                id="sampleRate"
                type="number"
                value={settings?.sample_rate || 16000}
                disabled={true}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">Audio sample rate for recording</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volumeThreshold" className="text-muted-foreground">Volume Threshold</Label>
              <Input
                id="volumeThreshold"
                type="number"
                value={settings?.volume_threshold || 0.005}
                disabled={true}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">Minimum volume to start recording</p>
            </div>
          </CardContent>
        </Card>

        {/* Status & Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>
              Application status and system details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Data Directory</h4>
              <p className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded break-all">
                {dataDirectory || 'Loading...'}
              </p>
            </div>

            <Separator />              <div className="space-y-2">
                <h4 className="text-sm font-medium">Application Version</h4>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">VWisper v1.0.1</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => checkForUpdates()}
                    disabled={checkingUpdates}
                    className="h-7 px-2 text-xs"
                  >
                    {checkingUpdates ? 'Checking...' : 'Check for Updates'}
                  </Button>
                </div>
                {updateStatus && (
                  <div className={`p-2 rounded text-xs ${
                    updateStatus.type === 'success' 
                      ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
                      : updateStatus.type === 'update'
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                      : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  }`}>
                    {updateStatus.message}
                    {updateStatus.type === 'update' && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openGitHubReleases}
                          className="h-6 px-2 text-xs"
                        >
                          Download Update
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">How to use VWisper:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Open any text editor or document where you want text</li>
                <li>• Click to position your cursor in the text area</li>
                <li>• Hold Right Ctrl on windows & linux or Left control on mac to start recording</li>
                <li>• Release Right Ctrl to stop and transcribe</li>
                <li>• Text will be automatically typed at cursor</li>
                <li>• Configure API key for transcription to work</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
