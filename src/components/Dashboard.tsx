import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  RotateCcw,
  Github,
  Sun,
  Moon,
  Monitor,
  BookOpen,
  Play,
  BarChart3,
  History as HistoryIcon,
  Settings as SettingsIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import iconPath from '../assets/icon.png';

// Import our separate components
import Playground from './dashboard/Playground';
import Analytics from './dashboard/Analytics';
import History from './dashboard/History';
import Settings from './dashboard/Settings';
import Onboarding from './dashboard/Onboarding';
import Changelog from './dashboard/Changelog';

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
  const [isRecording] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    loadDashboardData();
    // Apply system theme on load
    applyTheme('system');
    // Check for updates automatically
    checkForUpdates();
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
      
      // Check if user needs onboarding (no API key)
      setShowOnboarding(!settingsData.groq_api_key || settingsData.groq_api_key.trim() === '');
      
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
      const result = await invoke<{
        local_version: string;
        remote_version: string;
        has_update: boolean;
        success: boolean;
        error_message?: string;
      }>("check_for_updates");
      
      if (result.success) {
        if (result.has_update) {
          setUpdateStatus({
            type: 'update',
            message: `New version ${result.remote_version} is available! You're currently running v${result.local_version}.`
          });
        } else {
          setUpdateStatus({
            type: 'success',
            message: `You're running the latest version (v${result.local_version}).`
          });
        }
      } else {
        setUpdateStatus({
          type: 'error',
          message: result.error_message || 'Failed to check for updates.'
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

  const handleQuickAction = async (action: string) => {
    try {
      if (action === 'record') {
        // Handle record action
      } else if (action === 'refresh') {
        await loadDashboardData();
      }
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (error) {
      console.error("Failed to save settings:", error);
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
      if (!isValid) {
        setMessage({ type: 'error', text: 'API key is invalid or expired' });
      }
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
    const updated = { ...settings, [key]: value } as AppSettings;
    setSettings(updated);
    if (key === 'groq_api_key') {
      setApiKeyValid(null);
    }
    // Persist immediately
    saveSettings(updated);
  };

  const handleOnboardingComplete = async (apiKey: string) => {
    if (!settings) return;
    
    // Update settings with the API key
    const updated = { ...settings, groq_api_key: apiKey } as AppSettings;
    setSettings(updated);
    await saveSettings(updated);
    
    // Hide onboarding and reload data
    setShowOnboarding(false);
    setMessage({ type: 'success', text: 'Welcome to VWisper! Your setup is complete.' });
    setTimeout(() => setMessage(null), 4000);
    
    // Reload dashboard data to reflect the new settings
    await loadDashboardData();
  };

  const handleOnboardingApiTest = async (apiKey: string): Promise<boolean> => {
    try {
      return await invoke<boolean>("test_groq_api_key", { apiKey });
    } catch (error) {
      console.error("Failed to test API key during onboarding:", error);
      return false;
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen bg-background text-foreground flex">
          <Sidebar variant="sidebar" className="border-r">
            <SidebarHeader className="border-b p-4">
              <div className="flex items-center space-x-3">
                <img src={iconPath} alt="VWisper" className="w-8 h-8" />
                <span className="font-semibold text-lg">VWisper</span>
              </div>
            </SidebarHeader>
            <SidebarContent className="p-4">
              <SidebarGroup>
                <SidebarGroupLabel className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Loading...
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'playground':
        return (
          <Playground 
            isRecording={isRecording}
            liveTranscriptionText={liveTranscriptionText}
            setLiveTranscriptionText={setLiveTranscriptionText}
            settings={settings}
          />
        );
      case 'analytics':
        return <Analytics analytics={analytics} stats={stats} />;
      case 'history':
        return (
          <History 
            settings={settings}
            setMessage={setMessage}
          />
        );
      case 'settings':
        return (
          <Settings
            settings={settings}
            updateSettings={updateSettings}
            testApiKey={testApiKey}
            openGroqConsole={openGroqConsole}
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
        );
      case 'changelog':
        return (
          <Changelog
            openGitHubReleases={openGitHubReleases}
          />
        );
      default:
        return <div>Page not found</div>;
    }
  };

  // Show onboarding if user doesn't have API key configured
  if (showOnboarding && !loading) {
    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        onTestApiKey={handleOnboardingApiTest}
        openGroqConsole={openGroqConsole}
      />
    );
  }

  return (
    <SidebarProvider>
      <div className="h-screen w-screen bg-background text-foreground flex overflow-hidden">
        <Sidebar variant="sidebar" className="border-r flex-shrink-0">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center space-x-3">
              <img src={iconPath} alt="VWisper" className="w-8 h-8" />
              <span className="font-semibold text-lg">VWisper</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4">
            <SidebarGroup>
              <SidebarGroupLabel className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeTab === 'playground'}
                      onClick={() => setActiveTab('playground')}
                      className="w-full justify-start"
                    >
                      <Play className="w-4 h-4 mr-3" />
                      <span>Playground</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeTab === 'analytics'}
                      onClick={() => setActiveTab('analytics')}
                      className="w-full justify-start"
                    >
                      <BarChart3 className="w-4 h-4 mr-3" />
                      <span>Analytics</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeTab === 'history'}
                      onClick={() => setActiveTab('history')}
                      className="w-full justify-start"
                    >
                      <HistoryIcon className="w-4 h-4 mr-3" />
                      <span>History</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeTab === 'settings'}
                      onClick={() => setActiveTab('settings')}
                      className="w-full justify-start"
                    >
                      <SettingsIcon className="w-4 h-4 mr-3" />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={activeTab === 'changelog'}
                      onClick={() => setActiveTab('changelog')}
                      className="w-full justify-start"
                    >
                      <BookOpen className="w-4 h-4 mr-3" />
                      <span>Changelog</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center justify-center">
              <div className="flex space-x-1 bg-muted/30 rounded-lg p-1">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openGitHub}
                  className="h-8 w-8 p-0"
                  title="Open GitHub Repository"
                >
                  <Github className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col overflow-hidden w-full flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                {activeTab === 'playground' && 'Text Playground'}
                {activeTab === 'analytics' && 'Analytics & Overview'}
                {activeTab === 'history' && 'Transcription History'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction('refresh')}
                className="h-9 w-9 p-0"
                title="Refresh Data"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto w-full">
            {/* Update Banner */}
            {updateStatus && updateStatus.type === 'update' && (
              <Alert className="m-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
                <div className="flex items-center justify-between w-full">
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    {updateStatus.message}
                  </AlertDescription>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openGitHubReleases}
                    className="h-8 px-3 text-xs"
                  >
                    Download Update
                  </Button>
                </div>
              </Alert>
            )}

            {/* Success Message Banner */}
            {message && message.type === 'success' && (
              <Alert className="m-6 border-green-500 bg-green-50 dark:bg-green-950">
                <AlertDescription className="text-green-700 dark:text-green-400">
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message Banner */}
            {message && message.type === 'error' && (
              <Alert className="m-6 border-red-500 bg-red-50 dark:bg-red-950"> 
                <AlertDescription className="text-red-700 dark:text-red-400">
                  {message.text}
                </AlertDescription>
              </Alert>
            )}

            {/* Main Content */}
            <div className="p-6 w-full max-w-full overflow-x-hidden">
              {renderContent()}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>

);
};

export default Dashboard;
