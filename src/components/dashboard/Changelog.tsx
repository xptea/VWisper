import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ExternalLink, BookOpen, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChangelogProps {
  openGitHubReleases: () => void;
}

const Changelog: React.FC<ChangelogProps> = ({ openGitHubReleases }) => {
  const [changelogContent, setChangelogContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChangelog();
  }, []);

  const loadChangelog = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/CHANGELOG.md');
      if (!response.ok) {
        throw new Error(`Failed to load changelog: ${response.status}`);
      }
      const content = await response.text();
      setChangelogContent(content);
    } catch (err) {
      console.error('Failed to load changelog:', err);
      setError('Failed to load changelog. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Changelog</h2>
            <p className="text-muted-foreground">
              Latest updates and improvements to VWisper
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-4 bg-muted animate-pulse rounded"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Changelog</h2>
            <p className="text-muted-foreground">
              Latest updates and improvements to VWisper
            </p>
          </div>
        </div>
        <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button onClick={loadChangelog} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Changelog</h2>
          <p className="text-muted-foreground">
            Latest updates and improvements to VWisper
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            <BookOpen className="w-3 h-3 mr-1" />
            Release Notes
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={openGitHubReleases}
            className="h-9"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View on GitHub
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>Release History</span>
          </CardTitle>
          <CardDescription>
            Complete history of features, improvements, and bug fixes
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown 
              components={{
                h1: ({children}) => <h1 className="text-2xl font-bold mb-4 text-foreground">{children}</h1>,
                h2: ({children}) => (
                  <div className="mt-8 mb-4">
                    <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">{children}</h2>
                  </div>
                ),
                h3: ({children}) => <h3 className="text-lg font-medium mb-2 mt-6 text-foreground">{children}</h3>,
                h4: ({children}) => <h4 className="text-base font-medium mb-2 mt-4 text-foreground">{children}</h4>,
                p: ({children}) => <p className="mb-3 text-foreground leading-relaxed">{children}</p>,
                ul: ({children}) => <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>,
                li: ({children}) => <li className="text-foreground">{children}</li>,
                hr: () => <Separator className="my-6" />,
                strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                code: ({children}) => <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                a: ({href, children}) => {
                  if (href?.includes('github.com') && href?.includes('releases')) {
                    return (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-primary hover:text-primary/80 underline font-medium"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a 
                      href={href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {changelogContent}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Changelog;
