import { useEffect, useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SiteHeader } from "@/components/dashboard/sheader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartAreaInteractive } from "@/components/dashboard/chart";
import { DataTable } from "@/components/dashboard/table";
import { format } from "date-fns";

export default function DashboardPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const value = await invoke("get_transcription_history");
      const entries = value as any[];
      const mapped = entries.map((entry) => ({
        id: entry.id,
        header: entry.text?.slice(0, 32) + (entry.text?.length > 32 ? "..." : "") || "No text",
        type: "audio",
        status: entry.status || "-",
        round_trip_ms: entry.round_trip_ms || null,
        hold_time_ms: entry.hold_time_ms || null,
        wav_path: entry.wav_path,
        timestamp: entry.timestamp,
        date: entry.timestamp ? format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss") : "-",
        text: entry.text || "",
      }));
      
      // Sort by timestamp (newest first)
      mapped.sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dateB - dateA;
      });
      
      setHistory(mapped);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Memoize expensive computations
  const stats = useMemo(() => {
    const totalTranscriptions = history.length;
    const successCount = history.filter(h => h.status === "success").length;
    const successRate = totalTranscriptions > 0 ? Math.round((successCount / totalTranscriptions) * 100) : 0;
    const apiAvg = totalTranscriptions > 0 ? Math.round(history.reduce((sum, h) => sum + (h.round_trip_ms || 0), 0) / totalTranscriptions) : 0;
    
    const totalWords = history.reduce((sum, h) => {
      if (!h.text) return sum;
      return sum + h.text.split(/\s+/).filter(Boolean).length;
    }, 0);
    
    const totalMinutes = history.length;
    const avgWordsPerMin = totalMinutes > 0 ? Math.round(totalWords / totalMinutes) : 0;
    
    // Calculate WPM based on hold time if available
    const entriesWithHoldTime = history.filter(h => h.hold_time_ms && h.text);
    const totalHoldTimeSeconds = entriesWithHoldTime.reduce((sum, h) => sum + (h.hold_time_ms / 1000), 0);
    const totalHoldWords = entriesWithHoldTime.reduce((sum, h) => {
      return sum + h.text.split(/\s+/).filter(Boolean).length;
    }, 0);
    const wpmBasedOnHoldTime = totalHoldTimeSeconds > 0 ? Math.round((totalHoldWords / totalHoldTimeSeconds) * 60) : 0;

    return {
      totalTranscriptions,
      successRate,
      apiAvg,
      avgWordsPerMin,
      wpmBasedOnHoldTime,
      entriesWithHoldTime: entriesWithHoldTime.length
    };
  }, [history]);

  // Memoize chart data computation
  const chartData = useMemo(() => {
    const map = new Map<string, { date: string, words: number }>();
    
    history.forEach(h => {
      if (!h.timestamp || !h.text) return;
      const date = new Date(h.timestamp).toISOString().slice(0, 10);
      const words = h.text.split(/\s+/).filter(Boolean).length;
      if (!map.has(date)) map.set(date, { date, words: 0 });
      map.get(date)!.words += words;
    });
    
    // Fill last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      days.push({
        date,
        words: map.get(date)?.words || 0,
        mobile: map.get(date)?.words || 0,
        desktop: 0
      });
    }
    return days;
  }, [history]);

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">VWisper Dashboard</h2>
              </div>
              <Separator className="my-4" />

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>1. Set Groq API Key</CardTitle>
                    <CardDescription>
                      Enter your Groq API key in the settings to enable transcription.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>2. Open Any Text Box</CardTitle>
                    <CardDescription>
                      Click into any text box in the app where you want to insert your transcription.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>3. Hold Right Ctrl & Talk</CardTitle>
                    <CardDescription>
                      Hold down <span className="font-semibold">Right Ctrl</span>, speak, then release to paste your speech into the text box.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>



              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Transcriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTranscriptions}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Words Per Min</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.wpmBasedOnHoldTime}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.successRate}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg API Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.apiAvg} ms</div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-8">
                <Card>
                  <CardHeader>
                    <CardTitle>Transcription Activity</CardTitle>
                    <CardDescription>
                      Daily transcription activity over the last 30 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <ChartAreaInteractive data={chartData} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Transcription History</CardTitle>
                  <CardDescription>
                    View and manage all your transcription files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input placeholder="Search transcriptions..." className="max-w-sm" />
                      <Button variant="outline">Filter</Button>
                    </div>
                    {loading ? (
                      <div>Loading...</div>
                    ) : (
                      <DataTable data={history} />
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
