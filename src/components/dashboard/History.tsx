import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History as HistoryIcon, 
  RotateCcw, 
  Search, 
  Trash2, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  ChevronDown
} from 'lucide-react';

interface TranscriptionEntry {
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

interface HistoryStats {
  total_entries: number;
  success_rate: number;
  average_processing_time_ms: number;
  total_characters: number;
  total_words: number;
}

interface HistoryProps {
  settings: any;
  setMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
}

type FilterType = 'all' | 'success' | 'error';
type SortType = 'newest' | 'oldest';

const History: React.FC<HistoryProps> = ({ settings, setMessage }) => {
  const [historyEntries, setHistoryEntries] = useState<TranscriptionEntry[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [filteredEntries, setFilteredEntries] = useState<TranscriptionEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings?.save_history) {
      loadHistoryData();
    }
  }, [settings?.save_history]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [historyEntries, searchQuery, filterType, sortType]);

  const loadHistoryData = async () => {
    setLoading(true);
    try {
      const [historyData, statsData] = await Promise.all([
        invoke<TranscriptionEntry[]>("get_transcription_history", { limit: 1000 }),
        invoke<HistoryStats>("get_history_stats")
      ]);
      
      setHistoryEntries(historyData);
      setHistoryStats(statsData);
    } catch (error) {
      console.error("Failed to load history data:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...historyEntries];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(entry => 
        entry.transcribed_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.error_message?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType === 'success') {
      filtered = filtered.filter(entry => entry.success);
    } else if (filterType === 'error') {
      filtered = filtered.filter(entry => !entry.success);
    }

    // Apply sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortType === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setFilteredEntries(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const deleteHistoryEntry = async (entryId: string) => {
    try {
      const success = await invoke<boolean>("delete_transcription_entry", { entryId });
      if (success) {
        await loadHistoryData();
        setMessage({ type: 'success', text: 'History entry deleted successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to delete history entry' });
      }
    } catch (error) {
      console.error("Failed to delete history entry:", error);
      setMessage({ type: 'error', text: 'Failed to delete history entry' });
    }
  };

  const clearAllHistory = async () => {
    try {
      await invoke("clear_transcription_history");
      await loadHistoryData();
      setMessage({ type: 'success', text: 'All history cleared successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to clear history:", error);
      setMessage({ type: 'error', text: 'Failed to clear history' });
    }
  };

  // Pagination calculations
  const totalItems = filteredEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEntries = filteredEntries.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const loadMore = () => {
    setCurrentPage(prev => prev + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transcription History</h2>
          <p className="text-muted-foreground">
            View and manage your past transcriptions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {settings?.save_history ? (
            <Badge variant="default">
              <HistoryIcon className="w-3 h-3 mr-1" />
              History Enabled
            </Badge>
          ) : (
            <Badge variant="secondary">
              <HistoryIcon className="w-3 h-3 mr-1" />
              History Disabled
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadHistoryData}
            title="Refresh History"
            disabled={loading}
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!settings?.save_history ? (
        <Alert>
          <AlertDescription>
            History saving is currently disabled. Enable it in the Settings tab to start saving your transcriptions.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* History Stats */}
          {historyStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{historyStats.total_entries}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{historyStats.success_rate.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{historyStats.average_processing_time_ms}ms</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Words</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{historyStats.total_words.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Characters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{historyStats.total_characters.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Search & Filter History</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllHistory}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transcriptions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filter by Type */}
                <Select value={filterType} onValueChange={(value: FilterType) => setFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entries</SelectItem>
                    <SelectItem value="success">Success Only</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort by Date */}
                <Select value={sortType} onValueChange={(value: SortType) => setSortType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>

                {/* Items per Page */}
                <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Items per page" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                    <SelectItem value="250">250 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                <span>
                  Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} entries
                  {searchQuery && ` (filtered from ${historyEntries.length} total)`}
                </span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('all');
                      setSortType('newest');
                    }}
                  >
                    <Filter className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Transcription History</CardTitle>
              <CardDescription>
                Page {currentPage} of {totalPages} ({totalItems} total entries)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <HistoryIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No transcription history found.</p>
                  {(searchQuery || filterType !== 'all') && (
                    <p className="text-sm">Try adjusting your search or filters.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {currentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={entry.success ? "default" : "destructive"}
                            className={entry.success ? "" : "bg-red-600 hover:bg-red-700"}
                          >
                            {entry.success ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {entry.success ? 'Success' : 'Failed'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteHistoryEntry(entry.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {entry.transcribed_text ? (
                        <p className="text-sm mb-2 p-2 bg-muted/50 rounded text-left">
                          "{entry.transcribed_text}"
                        </p>
                      ) : entry.error_message ? (
                        <p className="text-sm mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300">
                          Error: {entry.error_message}
                        </p>
                      ) : (
                        <p className="text-sm mb-2 p-2 bg-muted/50 rounded text-muted-foreground italic">
                          No transcription text
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Duration: {Math.round(entry.audio_length_ms / 1000)}s
                          </span>
                          <span className="flex items-center">
                            <Activity className="w-3 h-3 mr-1" />
                            Processed: {entry.processing_time_ms}ms
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{Math.round(entry.transcription_length / 5.7)} words</span>
                          <span>{entry.transcription_length} chars</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {[...Array(Math.min(5, totalPages))].map((_, index) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = index + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = index + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + index;
                        } else {
                          pageNumber = currentPage - 2 + index;
                        }

                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNumber}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>

                  {/* Load More Option */}
                  {currentPage < totalPages && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        className="w-full max-w-xs"
                      >
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Load More ({itemsPerPage} more items)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default History;
