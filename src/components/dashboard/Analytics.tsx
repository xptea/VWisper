import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { BarChart3, Activity, Clock, FileText, TrendingUp, Mic, CheckCircle, XCircle, Clock2 } from 'lucide-react';

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
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');

  const getEstimatedWordCount = (): number => {
    if (!stats || stats.total_characters_transcribed === 0) return 0;
    // Average word length in English is approximately 4.7 characters
    // Add space characters between words, so roughly 5.7 characters per word
    return Math.round(stats.total_characters_transcribed / 5.7);
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

  const getProcessingSpeed = (): string => {
    if (!stats || stats.average_processing_time_ms === 0) return "0ms";
    return `${Math.round(stats.average_processing_time_ms)}ms`;
  };

  const getFilteredChartData = () => {
    // Always return an array, even if empty
    if (!analytics?.daily_stats || analytics.daily_stats.length === 0) {
      // Return empty data based on time range
      const emptyDays = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 1;
      return Array.from({ length: emptyDays }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (emptyDays - 1 - i));
        return {
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          recordings: 0,
          duration: 0,
          characters: 0
        };
      });
    }
    
    const sortedStats = [...analytics.daily_stats].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let filteredStats = sortedStats;
    
    if (timeRange === 'week') {
      // Get last 7 days
      filteredStats = sortedStats.slice(-7);
    } else if (timeRange === 'month') {
      // Get last 30 days
      filteredStats = sortedStats.slice(-30);
    }
    // 'all' shows all data

    return filteredStats.map(stat => ({
      date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      recordings: stat.recordings,
      duration: Math.round(stat.duration_ms / 1000 / 60), // Convert to minutes
      characters: stat.characters_transcribed
    }));
  };

  // Get filtered stats based on time range
  const getFilteredStats = () => {
    if (!analytics?.daily_stats || analytics.daily_stats.length === 0) {
      return {
        totalRecordings: 0,
        totalDuration: 0,
        totalCharacters: 0,
        avgPerRecording: 0,
        filteredDays: []
      };
    }

    const sortedStats = [...analytics.daily_stats].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let filteredStats = sortedStats;
    
    if (timeRange === 'week') {
      // Get last 7 days
      filteredStats = sortedStats.slice(-7);
    } else if (timeRange === 'month') {
      // Get last 30 days
      filteredStats = sortedStats.slice(-30);
    }

    const totalRecordings = filteredStats.reduce((sum, stat) => sum + stat.recordings, 0);
    const totalDuration = filteredStats.reduce((sum, stat) => sum + stat.duration_ms, 0);
    const totalCharacters = filteredStats.reduce((sum, stat) => sum + stat.characters_transcribed, 0);

    return {
      totalRecordings,
      totalDuration,
      totalCharacters,
      avgPerRecording: totalRecordings > 0 ? Math.round(totalCharacters / 5.7 / totalRecordings) : 0,
      filteredDays: filteredStats
    };
  };

  // Get filtered stats based on time range
  const filteredStats = useMemo(() => getFilteredStats(), [analytics, timeRange]);
  const chartData = useMemo(() => {
    console.log('Recalculating chart data for timeRange:', timeRange);
    const result = getFilteredChartData();
    console.log('Chart data result:', result);
    return result;
  }, [timeRange, analytics]);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Total Recordings</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Total Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Total Words</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getEstimatedWordCount().toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Words transcribed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency Analytics - reorganized logically */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Words per Minute</CardTitle>
            <Clock2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_duration_ms ? Math.round((getEstimatedWordCount() * 60000) / stats.total_duration_ms) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Average transcription speed
            </p>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Characters per Minute</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_duration_ms ? Math.round((stats.total_characters_transcribed * 60000) / stats.total_duration_ms) : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Characters per minute
            </p>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Processing Speed</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getProcessingSpeed()}</div>
            <p className="text-xs text-muted-foreground">
              Average processing time
            </p>
          </CardContent>
        </Card>

        <Card className="w-full min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium truncate">Time Saved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const wordCount = getEstimatedWordCount();
                const typingTimeMinutes = wordCount / 40; // 40 WPM average typing speed
                const recordingTimeMinutes = (stats?.total_duration_ms || 0) / 60000;
                const timeSaved = Math.max(0, typingTimeMinutes - recordingTimeMinutes);
                return Math.round(timeSaved);
              })()} min
            </div>
            <p className="text-xs text-muted-foreground">
              vs manual typing
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h3 className="text-lg font-semibold">Analytics Overview</h3>
        <Select value={timeRange} onValueChange={(value: 'week' | 'month' | 'all') => setTimeRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Charts Section */}
      <div className="space-y-6 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
          {/* Word Count Summary - moved to top left */}
          <Card className="w-full min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span>Word Count Summary</span>
              </CardTitle>
              <CardDescription>
                Your transcription word statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(filteredStats.totalCharacters / 5.7).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {timeRange === 'week' ? 'Week' : timeRange === 'month' ? 'Month' : 'All Time'} Words Transcribed
                </p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg per Recording:</span>
                  <span className="font-medium">
                    {filteredStats.avgPerRecording} words
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Words per Minute:</span>
                  <span className="font-medium">
                    {filteredStats.totalDuration ? Math.round((filteredStats.totalCharacters / 5.7 * 60000) / filteredStats.totalDuration) : 0} WPM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Character Count:</span>
                  <span className="font-medium">
                    {filteredStats.totalCharacters.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card className="w-full min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 flex-shrink-0" />
                <span>Usage Statistics</span>
              </CardTitle>
              <CardDescription>
                Your transcription patterns and insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {timeRange === 'week' ? 'Week' : timeRange === 'month' ? 'Month' : 'All Time'} Recordings
                  </span>
                  <Badge variant="secondary">{filteredStats.totalRecordings} recordings</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {timeRange === 'week' ? 'Week' : timeRange === 'month' ? 'Month' : 'All Time'} Duration
                  </span>
                  <Badge variant="secondary">{formatDuration(filteredStats.totalDuration)}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Time</span>
                  <Badge variant="outline">{stats?.average_processing_time_ms || 0} ms</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Most Active Day</span>
                  <Badge variant="outline">{analytics?.most_active_day || 'N/A'}</Badge>
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

        <Card className="w-full min-w-0">
          <CardHeader>
            <CardTitle>Detailed Analytics</CardTitle>
            <CardDescription>
              Deep dive into your transcription patterns
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
              {/* Recording Activity Chart - moved here */}
              <div className="w-full min-w-0 overflow-hidden">
                <h4 className="text-sm font-medium mb-3 flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 flex-shrink-0" />
                  <span>Recording Activity</span>
                </h4>
                <ChartContainer
                  key={`recordings-${timeRange}`}
                  config={{
                    recordings: {
                      label: "Recordings",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
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
              </div>

              {/* Duration Chart */}
              <div className="w-full min-w-0 overflow-hidden">
                <h4 className="text-sm font-medium mb-3">Recording Duration (minutes)</h4>
                <ChartContainer
                  key={`duration-${timeRange}`}
                  config={{
                    duration: {
                      label: "Duration (min)",
                      color: "hsl(var(--chart-2))",
                    },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="duration"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>

              {/* Characters Chart */}
              <div className="w-full min-w-0 overflow-hidden">
                <h4 className="text-sm font-medium mb-3">Characters Transcribed</h4>
                <ChartContainer
                  key={`characters-${timeRange}`}
                  config={{
                    characters: {
                      label: "Characters",
                      color: "hsl(var(--chart-3))",
                    },
                  }}
                  className="h-[200px] w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis hide />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="characters"
                        stroke="hsl(var(--chart-3))"
                        fill="hsl(var(--chart-3))"
                        fillOpacity={0.2}
                        strokeWidth={2}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default Analytics;
