import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface DashboardStats {
  total_recordings: number;
  total_duration_ms: number;
  successful_recordings: number;
  failed_recordings: number;
  total_characters_transcribed: number;
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
  groq_api_key?: string;
  shortcut_enabled: boolean;
  auto_start: boolean;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [formattedStats, analyticsData, settingsData] = await Promise.all([
        invoke<any>("get_formatted_usage_stats"),
        invoke<AnalyticsData>("get_analytics_data"),
        invoke<AppSettings>("load_settings")
      ]);
      
      // Convert the formatted stats to our interface
      const dashboardStats: DashboardStats = {
        total_recordings: formattedStats.total_recordings,
        total_duration_ms: formattedStats.total_duration_ms,
        successful_recordings: formattedStats.successful_recordings,
        failed_recordings: formattedStats.failed_recordings,
        total_characters_transcribed: formattedStats.total_characters_transcribed,
        first_use: formattedStats.first_use,
        last_use: formattedStats.last_use,
      };
      
      setStats(dashboardStats);
      setAnalytics(analyticsData);
      setSettings(settingsData);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
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
      switch (action) {
        case 'start_recording':
          await invoke('start_recording');
          setIsRecording(true);
          break;
        case 'settings':
          await invoke('open_settings_window');
          break;
        case 'refresh':
          await loadDashboardData();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
    }
  };

  const closeWindow = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
    } catch (error) {
      console.error("Failed to close window:", error);
    }
  };

  const minimizeWindow = async () => {
    try {
      const window = getCurrentWindow();
      await window.minimize();
    } catch (error) {
      console.error("Failed to minimize window:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Custom Window Controls */}
      <div className="flex justify-between items-center p-4 bg-gray-900 border-b border-gray-800 drag-region">
        <h1 className="text-xl font-bold">VWisper Dashboard</h1>
        <div className="flex space-x-2 no-drag">
          <button
            onClick={minimizeWindow}
            className="w-6 h-6 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center transition-colors"
            title="Minimize"
          >
            <span className="text-xs">−</span>
          </button>
          <button
            onClick={closeWindow}
            className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
            title="Close"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleQuickAction('start_recording')}
            disabled={isRecording}
            className="bg-white text-black p-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:text-gray-400"
          >
            {isRecording ? 'Recording...' : 'Start Recording'}
          </button>
          <button
            onClick={() => handleQuickAction('settings')}
            className="bg-gray-800 text-white p-4 rounded-lg font-semibold hover:bg-gray-700 transition-colors border border-gray-600"
          >
            Settings
          </button>
          <button
            onClick={() => handleQuickAction('refresh')}
            className="bg-gray-800 text-white p-4 rounded-lg font-semibold hover:bg-gray-700 transition-colors border border-gray-600"
          >
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Total Recordings</h3>
            <p className="text-3xl font-bold">{stats?.total_recordings || 0}</p>
          </div>
          
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Total Duration</h3>
            <p className="text-3xl font-bold">{formatDuration(stats?.total_duration_ms || 0)}</p>
          </div>
          
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Success Rate</h3>
            <p className="text-3xl font-bold">{getSuccessRate().toFixed(1)}%</p>
          </div>
          
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <h3 className="text-gray-400 text-sm uppercase tracking-wide mb-2">Characters</h3>
            <p className="text-3xl font-bold">{(stats?.total_characters_transcribed || 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h3 className="text-xl font-bold mb-4">Weekly Analytics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Daily Average</span>
                  <span className="font-semibold">{analytics.weekly_average.toFixed(1)} recordings</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Total</span>
                  <span className="font-semibold">{analytics.monthly_total} recordings</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Most Active Day</span>
                  <span className="font-semibold">{analytics.most_active_day}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
              <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {analytics.daily_stats.slice(-5).reverse().map((day) => (
                  <div key={day.date} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-b-0">
                    <span className="text-gray-400">{day.date}</span>
                    <div className="text-right">
                      <span className="font-semibold">{day.recordings}</span>
                      <span className="text-gray-400 text-sm ml-2">recordings</span>
                    </div>
                  </div>
                ))}
                {(!analytics.daily_stats || analytics.daily_stats.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No activity yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Section */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <h3 className="text-xl font-bold mb-4">System Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${settings?.groq_api_key ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-gray-300">API Key {settings?.groq_api_key ? 'Configured' : 'Missing'}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${settings?.shortcut_enabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-300">Shortcuts {settings?.shortcut_enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${settings?.auto_start ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-300">Auto Start {settings?.auto_start ? 'On' : 'Off'}</span>
            </div>
          </div>
        </div>

        {/* Last Used */}
        {stats?.last_use && (
          <div className="text-center text-gray-500 text-sm">
            Last used: {new Date(stats.last_use).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
