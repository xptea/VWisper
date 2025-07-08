import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';
import { BarChart3, Activity } from 'lucide-react';

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

interface AnalyticsProps {
  analytics: AnalyticsData | null;
  stats: DashboardStats | null;
}

const Analytics: React.FC<AnalyticsProps> = ({ analytics, stats }) => {
  const getEstimatedWordCount = (): number => {
    if (!stats || stats.total_characters_transcribed === 0) return 0;
    // Average word length in English is approximately 4.7 characters
    // Add space characters between words, so roughly 5.7 characters per word
    return Math.round(stats.total_characters_transcribed / 5.7);
  };

  // Prepare chart data
  const chartData = analytics?.daily_stats?.map(stat => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    recordings: stat.recordings,
    duration: Math.round(stat.duration_ms / 1000 / 60), // Convert to minutes
    characters: stat.characters_transcribed
  })) || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Recording Activity</span>
            </CardTitle>
            <CardDescription>
              Daily recording sessions over the past week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer
                config={{
                  recordings: {
                    label: "Recordings",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[200px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="recordings"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Usage Statistics</span>
            </CardTitle>
            <CardDescription>
              Your transcription patterns and insights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weekly Average</span>
                <Badge variant="secondary">{analytics?.weekly_average || 0} recordings</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly Total</span>
                <Badge variant="secondary">{analytics?.monthly_total || 0} recordings</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Round Trip Avg</span>
                <Badge variant="outline">{stats?.average_processing_time_ms || 0} ms</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Most Active Day</span>
                <Badge variant="outline">{analytics?.most_active_day || 'N/A'}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Peak Usage Hour</span>
                <Badge variant="outline">{analytics?.peak_usage_hour || 0}:00</Badge>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">First Use</span>
                <span className="text-sm">
                  {stats?.first_use ? new Date(stats.first_use).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Use</span>
                <span className="text-sm">
                  {stats?.last_use ? new Date(stats.last_use).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Analytics</CardTitle>
          <CardDescription>
            Deep dive into your transcription patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Duration Chart */}
            <div>
              <h4 className="text-sm font-medium mb-3">Recording Duration (minutes)</h4>
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    duration: {
                      label: "Duration (min)",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[150px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="duration"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>

            {/* Characters Chart */}
            <div>
              <h4 className="text-sm font-medium mb-3">Characters Transcribed</h4>
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    characters: {
                      label: "Characters",
                      color: "hsl(var(--chart-3))",
                    },
                  }}
                  className="h-[150px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="characters"
                        fill="hsl(var(--chart-3))"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </div>

            {/* Word Count Summary */}
            <div>
              <h4 className="text-sm font-medium mb-3">Word Count Summary</h4>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary">
                    {getEstimatedWordCount().toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Total Words Transcribed
                  </p>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg per Recording:</span>
                    <span className="font-medium">
                      {stats?.total_recordings ? Math.round(getEstimatedWordCount() / stats.total_recordings) : 0} words
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Words per Minute:</span>
                    <span className="font-medium">
                      {stats?.total_duration_ms ? Math.round((getEstimatedWordCount() * 60000) / stats.total_duration_ms) : 0} WPM
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Character Count:</span>
                    <span className="font-medium">
                      {stats?.total_characters_transcribed?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
