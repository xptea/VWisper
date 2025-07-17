import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { Mic, Clock, FileText, CheckCircle, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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

interface DashboardCardsProps {
  usageStats: UsageStats | null;
  analyticsData: AnalyticsData | null;
  loading: boolean;
}

export function DashboardCards({ usageStats, analyticsData, loading }: DashboardCardsProps) {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getSuccessRate = (): number => {
    if (!usageStats || usageStats.total_recordings === 0) return 0;
    return Math.round((usageStats.successful_recordings / usageStats.total_recordings) * 100);
  };

  const getEstimatedWordCount = (): number => {
    if (!usageStats) return 0;
    // Rough estimate: 5 characters per word
    return Math.round(usageStats.total_characters_transcribed / 5);
  };

  if (loading) {
    return (
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Total Recordings
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(usageStats?.total_recordings || 0)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              {getSuccessRate()}% success
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {usageStats?.successful_recordings || 0} successful <CheckCircle className="size-4 text-green-500" />
          </div>
          <div className="text-muted-foreground">
            {usageStats?.failed_recordings || 0} failed recordings
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Total Duration
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatDuration(usageStats?.total_duration_ms || 0)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              {usageStats?.average_processing_time_ms ? 
                `${Math.round(usageStats.average_processing_time_ms / 1000)}s avg` : 
                'N/A'
              }
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Average processing time <Clock className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {analyticsData?.weekly_average ? 
              `${analyticsData.weekly_average.toFixed(1)} recordings/week` : 
              'No weekly data'
            }
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Characters Transcribed
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(usageStats?.total_characters_transcribed || 0)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              ~{formatNumber(getEstimatedWordCount())} words
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Estimated word count <FileText className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Based on 5 characters per word
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Success Rate
          </CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {getSuccessRate()}%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {getSuccessRate() >= 90 ? <IconTrendingUp /> : <IconTrendingDown />}
              {getSuccessRate() >= 90 ? 'Excellent' : 'Needs attention'}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {usageStats?.successful_recordings || 0} successful <CheckCircle className="size-4 text-green-500" />
          </div>
          <div className="text-muted-foreground">
            {usageStats?.failed_recordings || 0} failed <XCircle className="size-4 text-red-500" />
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
