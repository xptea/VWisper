import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppSettings {
  groq_api_key?: string;
  audio_device?: string;
  shortcut_enabled: boolean;
  auto_start: boolean;
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    groq_api_key: "",
    audio_device: "",
    shortcut_enabled: true,
    auto_start: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<AppSettings>("load_settings");
      setSettings(loadedSettings);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load settings:", error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await invoke("save_settings", { settings });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const testApiKey = async () => {
    if (!settings.groq_api_key) {
      setMessage({ type: 'error', text: 'Please enter an API key first' });
      return;
    }

    setTesting(true);
    setApiKeyValid(null);
    
    try {
      const isValid = await invoke<boolean>("test_groq_api_key", { 
        apiKey: settings.groq_api_key 
      });
      setApiKeyValid(isValid);
      setMessage({ 
        type: isValid ? 'success' : 'error', 
        text: isValid ? 'API key is valid!' : 'API key is invalid' 
      });
    } catch (error) {
      console.error("Failed to test API key:", error);
      setApiKeyValid(false);
      setMessage({ type: 'error', text: 'Failed to test API key' });
    } finally {
      setTesting(false);
    }
  };

  const validateApiKeyFormat = (key: string) => {
    return key.startsWith("gsk_") && key.length >= 50;
  };

  const handleApiKeyChange = (value: string) => {
    setSettings(prev => ({ ...prev, groq_api_key: value }));
    setApiKeyValid(null);
    
    if (value && !validateApiKeyFormat(value)) {
      setMessage({ type: 'error', text: 'API key format appears invalid (should start with "gsk_")' });
    } else {
      setMessage(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            VWisper Settings
          </h1>

          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {/* Groq API Key Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Groq API Key
              </label>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={settings.groq_api_key || ""}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="gsk_..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={testApiKey}
                    disabled={testing || !settings.groq_api_key}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Testing...</span>
                      </div>
                    ) : (
                      'Test'
                    )}
                  </button>
                </div>
                {apiKeyValid !== null && (
                  <div className={`text-sm ${
                    apiKeyValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {apiKeyValid ? '✓ API key is valid' : '✗ API key is invalid'}
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Get your API key from{' '}
                  <a 
                    href="https://console.groq.com/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Groq Console
                  </a>
                </p>
              </div>
            </div>

            {/* Shortcut Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Global Shortcuts
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.shortcut_enabled}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      shortcut_enabled: e.target.checked 
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable Right Ctrl shortcut for recording
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  Hold Right Ctrl to start recording, release to stop and transcribe
                </p>
              </div>
            </div>

            {/* Auto Start */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Startup
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.auto_start}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    auto_start: e.target.checked 
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Start VWisper automatically on system startup
                </span>
              </label>
            </div>

            {/* Audio Device (placeholder for future implementation) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Audio Device
              </label>
              <select
                value={settings.audio_device || "default"}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  audio_device: e.target.value === "default" ? undefined : e.target.value 
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="default">Default Microphone</option>
                {/* Future: populate with actual audio devices */}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={loadSettings}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Reset
              </button>
              <button
                onClick={saveSettings}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
            How to use VWisper:
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Hold Right Ctrl to start recording</li>
            <li>• Release Right Ctrl to stop and transcribe</li>
            <li>• Transcribed text will be automatically typed at your cursor</li>
            <li>• Access settings via the system tray icon</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Settings; 