import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Clock,
  FileText,
  TrendingUp,
  Mic,
  CheckCircle,
  XCircle,
  RotateCcw,
  Github,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import iconPath from '../assets/icon.png';

// Import our separate components
import Playground from './dashboard/Playground';
import Analytics from './dashboard/Analytics';
import History from './dashboard/History';
import Settings from './dashboard/Settings';

interface DashboardStats {
  total_recordings: number;
  total_duration_ms: number;
  successful_recordings: number;
  failed_recordings: number;
  total_characters_transcribed: number;
  average_processing_time_ms: number;
  first_use: string;
  last_use: string;
}

interface AnalyticsData {
  daily_stats: Array<{
    date: string;
    recordings: number;
    duration_ms: number;
    characters_transcribed: number;
  }>;
  weekly_average: number;
  monthly_total: number;
  most_active_day: string;
  peak_usage_hour: number;
}

interface AppSettings {
  sample_rate: number;
  volume_threshold: number;
  groq_api_key?: string;
  shortcut_enabled: boolean;
  auto_start: boolean;
  theme: 'light' | 'dark' | 'system';
  save_history: boolean;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>('playground');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [dataDirectory, setDataDirectory] = useState<string>('');
  const [liveTranscriptionText, setLiveTranscriptionText] = useState<string>('');
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{ type: 'success' | 'error' | 'update'; message: string } | null>(null);

  useEffect(() => {
    loadDashboardData();
    // Apply system theme on load
    applyTheme('system');
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [formattedStats, analyticsData, settingsData, dataDir] = await Promise.all([
        invoke<any>("get_formatted_usage_stats"),
        invoke<AnalyticsData>("get_analytics_data"),
        invoke<AppSettings>("load_settings"),
        invoke<string>("get_data_directory")
      ]);

      // Convert the formatted stats to our interface
      const dashboardStats: DashboardStats = {
        total_recordings: formattedStats.total_recordings,
        total_duration_ms: formattedStats.total_duration_ms,
        successful_recordings: formattedStats.successful_recordings,
        failed_recordings: formattedStats.failed_recordings,
        total_characters_transcribed: formattedStats.total_characters_transcribed,
        average_processing_time_ms: formattedStats.average_processing_time_ms,
        first_use: formattedStats.first_use,
        last_use: formattedStats.last_use,
      };

      setStats(dashboardStats);
      setAnalytics(analyticsData);
      setSettings(settingsData);
      setDataDirectory(dataDir);
      
      // Set theme from settings or default to system
      const userTheme = settingsData.theme || 'system';
      setTheme(userTheme);
      applyTheme(userTheme);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark');
    
    let appliedTheme: string;
    
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      appliedTheme = prefersDark ? 'dark' : 'light';
      root.classList.add(appliedTheme);
      console.log('Applied system theme:', appliedTheme);
    } else {
      appliedTheme = newTheme;
      root.classList.add(newTheme);
      console.log('Applied theme:', newTheme);
    }
    
    // Also set a data attribute for additional styling hooks
    root.setAttribute('data-theme', appliedTheme);
    
    // Force a re-render by updating a CSS custom property
    root.style.setProperty('--theme-transition', 'all 0.3s ease');
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    console.log('Theme changing to:', newTheme);
    console.log('Current theme state:', theme);
    
    setTheme(newTheme);
    applyTheme(newTheme);
    
    if (settings) {
      const updatedSettings = { ...settings, theme: newTheme };
      setSettings(updatedSettings);
      
      try {
        await invoke("save_settings", { settings: updatedSettings });
        console.log('Theme saved successfully:', newTheme);
      } catch (error) {
        console.error("Failed to save theme:", error);
      }
    } else {
      console.warn('No settings available to save theme');
    }
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    handleThemeChange(nextTheme);
  };

  const openGitHub = async () => {
    try {
      await invoke('open_url', { url: 'https://github.com/xptea/VWisper' });
    } catch (error) {
      console.error("Failed to open GitHub:", error);
    }
  };

  const openGroqConsole = async () => {
    try {
      await invoke('open_url', { url: 'https://console.groq.com/keys' });
    } catch (error) {
      console.error("Failed to open Groq console:", error);
    }
  };

  const checkForUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus(null);
    
    try {
      // Read local version
      const localVersion = await invoke<string>("read_version_file");
      
      // Fetch remote version from GitHub
      const response = await fetch('https://raw.githubusercontent.com/xptea/VWisper/refs/heads/main/version.txt');
      if (!response.ok) {
        throw new Error('Failed to fetch remote version');
      }
      
      const remoteVersion = (await response.text()).trim();
      
      // Compare versions
      if (compareVersions(remoteVersion, localVersion) > 0) {
        setUpdateStatus({
          type: 'update',
          message: `A new version (v${remoteVersion}) is available! You are currently running v${localVersion}.`
        });
      } else {
        setUpdateStatus({
          type: 'success',
          message: `You are running the latest version (v${localVersion}).`
        });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setUpdateStatus({
        type: 'error',
        message: 'Failed to check for updates. Please check your internet connection.'
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const openGitHubReleases = async () => {
    try {
      await invoke('open_url', { url: 'https://github.com/xptea/VWisper/releases/latest' });
    } catch (error) {
      console.error("Failed to open GitHub releases:", error);
    }
  };

  // Simple version comparison function
  const compareVersions = (version1: string, version2: string): number => {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getSuccessRate = (): number => {
    if (!stats || stats.total_recordings === 0) return 0;
    return (stats.successful_recordings / stats.total_recordings) * 100;
  };

  const handleQuickAction = async (action: string) => {
    try {
      if (action === 'record') {
        setIsRecording(!isRecording);
        await invoke('toggle_recording');
      } else if (action === 'refresh') {
        await loadDashboardData();
      }
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

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
    if (!settings?.groq_api_key) {
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

  const updateSettings = (key: keyof AppSettings, value: any) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [key]: value } : null);
    if (key === 'groq_api_key') {
      setApiKeyValid(null);
    }
  };

  const handleTabChange = async (newTab: string) => {
    console.log('Tab changing to:', newTab);
    setActiveTab(newTab);
    try {
      console.log('Calling resize_dashboard_for_tab with tab:', newTab);
      await invoke('resize_dashboard_for_tab', { tab: newTab });
      console.log('Successfully resized window for tab:', newTab);
    } catch (error) {
      console.error('Failed to resize window for tab:', newTab, error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Scrollable Content Container with Rounded Background */}
      <div className="h-screen overflow-y-auto force-scrollbar scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent no-drag">
        <div className="p-6 max-w-7xl mx-auto no-drag">
          {/* Background with rounded edges */}
          <div className="bg-card/30 rounded-3xl p-6 space-y-6 backdrop-blur-sm border border-border/50 shadow-lg no-drag">
            {/* Welcome Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src={iconPath} 
                  alt="VWisper Logo" 
                  className="w-8 h-8 object-contain"
                />
                <div>
                  <h1 className="text-2xl font-bold">VWisper Dashboard</h1>
                  <p className="text-muted-foreground">
                    Voice transcription analytics and settings
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    <Mic className="w-3 h-3 mr-1" />
                    Recording...
                  </Badge>
                )}
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={openGitHub}
                  className="h-8 w-8 p-0"
                  title="Visit GitHub"
                >
                  <Github className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleQuickAction('refresh')}
                  className="h-8 w-8 p-0"
                  title="Refresh Data"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={cycleTheme}
                  className="h-8 w-8 p-0" 
                  title={`Current: ${theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'} - Click to change`}
                >
                  {theme === 'light' ? <Sun className="w-4 h-4" /> : 
                   theme === 'dark' ? <Moon className="w-4 h-4" /> : 
                   <Monitor className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Recordings</CardTitle>
                  <Mic className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_recordings || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.successful_recordings || 0} successful
                  </p>
                  <Progress
                    value={getSuccessRate()}
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatDuration(stats?.total_duration_ms || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recording time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Characters Transcribed</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.total_characters_transcribed?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total text generated
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{getSuccessRate().toFixed(1)}%</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{stats?.successful_recordings || 0} success</span>
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span>{stats?.failed_recordings || 0} failed</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Analytics Tabs */}
            <Tabs defaultValue="playground" value={activeTab} onValueChange={handleTabChange} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="playground">Text Playground</TabsTrigger>
                <TabsTrigger value="analytics">Analytics & Overview</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="playground" className="space-y-4">
                <Playground 
                  isRecording={isRecording}
                  liveTranscriptionText={liveTranscriptionText}
                  setLiveTranscriptionText={setLiveTranscriptionText}
                  settings={settings}
                />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <Analytics analytics={analytics} stats={stats} />
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <History 
                  settings={settings}
                  setMessage={setMessage}
                />
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                {message && (
                  <Alert className={message.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}>
                    <AlertDescription className={message.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      {message.text}
                    </AlertDescription>
                  </Alert>
                )}

                <Settings
                  settings={settings}
                  updateSettings={updateSettings}
                  saveSettings={saveSettings}
                  testApiKey={testApiKey}
                  openGroqConsole={openGroqConsole}
                  saving={saving}
                  testing={testing}
                  apiKeyValid={apiKeyValid}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  dataDirectory={dataDirectory}
                  checkingUpdates={checkingUpdates}
                  updateStatus={updateStatus}
                  checkForUpdates={checkForUpdates}
                  openGitHubReleases={openGitHubReleases}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
