
import { Sidebar } from "@/components/Sidebar/Sidebar"
import { AnalyticsChart } from "@/components/Analytics/Chart"
import { HistoryTable } from "@/components/History/Table"
import { DashboardCards } from "@/components/Analytics/Cards"
import { AppHeader } from "@/components/Header/Header"
import Settings from "@/components/Settings/Settings"
import { Onboarding } from "@/components/Onboarding/Onboarding"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Toaster } from "sonner"

import React, { useState, useEffect } from "react"
import { ThemeProvider } from "next-themes"
import { invoke } from "@tauri-apps/api/core"


// Types for backend data
interface UsageStats {
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

interface RecordingSession {
  id: string;
  timestamp: string;
  duration_ms: number;
  audio_length_ms: number;
  transcription_length: number;
  transcribed_text: string;
  processing_time_ms: number;
  success: boolean;
  error_message?: string;
}

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



export default function Page() {
  const [section, setSection] = useState("analytics")
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [historyData, setHistoryData] = useState<RecordingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)

  // Fetch data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // First, check if API key is configured and if user has seen onboarding
        const appSettings = await invoke<AppSettings>("load_settings")
        
        // If no API key or user hasn't seen onboarding, show setup flow
        if (!appSettings.groq_api_key || !appSettings.has_seen_splash) {
          setShowSetup(true)
          setLoading(false)
          return
        }
        
        // Fetch other data only if API key is configured
        const [stats, analytics, history] = await Promise.all([
          invoke<UsageStats>("get_usage_stats"),
          invoke<AnalyticsData>("get_analytics_data"),
          invoke<RecordingSession[]>("get_transcription_history", { limit: 100 })
        ])
        
        setUsageStats(stats)
        setAnalyticsData(analytics)
        setHistoryData(history)
        
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  React.useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace("#", "")
      setSection(hash || "analytics")
    }
    window.addEventListener("hashchange", onHashChange)
    onHashChange()
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const handleSetupComplete = async () => {
    setShowSetup(false)
    // Refresh settings and data
    const [stats, analytics, history] = await Promise.all([
      invoke<UsageStats>("get_usage_stats"),
      invoke<AnalyticsData>("get_analytics_data"),
      invoke<RecordingSession[]>("get_transcription_history", { limit: 100 })
    ])
    
    setUsageStats(stats)
    setAnalyticsData(analytics)
    setHistoryData(history)
  }

  // Show onboarding flow if no API key is configured
  if (showSetup) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Onboarding onComplete={handleSetupComplete} />
        <Toaster />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 56)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties}
      >
        <Sidebar variant="inset" showSetup={false} />
        <SidebarInset>
          <AppHeader section={section} />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                {section === "analytics" && (
                  <>
                    <DashboardCards 
                      usageStats={usageStats}
                      analyticsData={analyticsData}
                      loading={loading}
                    />
                    <div className="px-4 lg:px-6">
                      <AnalyticsChart 
                        analyticsData={analyticsData}
                        loading={loading}
                      />
                    </div>
                  </>
                )}
                {section === "history" && (
                  <HistoryTable 
                    data={historyData}
                    loading={loading}
                    onRefresh={async () => {
                      try {
                        const history = await invoke<RecordingSession[]>("get_transcription_history", { limit: 100 })
                        setHistoryData(history)
                      } catch (error) {
                        console.error("Failed to refresh history:", error)
                      }
                    }}
                  />
                )}
                {section === "getting-started" && (
                  <div className="px-4 lg:px-6">
                    <div className="max-w-2xl mx-auto py-8">
                      <div className="text-center space-y-4">
                        <h2 className="text-2xl font-bold">Getting Started with VWisper</h2>
                        <p className="text-muted-foreground">
                          Learn how to use VWisper for speech-to-text transcription
                        </p>
                      </div>
                      
                      <div className="mt-8 space-y-6">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold">Quick Start Guide</h3>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-medium text-primary">1</span>
                              </div>
                              <div>
                                <p className="font-medium">Configure your API key</p>
                                <p className="text-sm text-muted-foreground">Go to Settings and add your Groq API key</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-medium text-primary">2</span>
                              </div>
                              <div>
                                <p className="font-medium">Start recording</p>
                                <p className="text-sm text-muted-foreground">Use the global shortcut (Ctrl) or click the recording button</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-medium text-primary">3</span>
                              </div>
                              <div>
                                <p className="font-medium">View your transcriptions</p>
                                <p className="text-sm text-muted-foreground">Check the History tab to see all your transcriptions</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {section === "settings" && <Settings />}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  )
}
