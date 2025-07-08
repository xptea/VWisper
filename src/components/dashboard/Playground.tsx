import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invoke } from '@tauri-apps/api/core';

interface PlaygroundProps {
  isRecording: boolean;
  liveTranscriptionText: string;
  setLiveTranscriptionText: (text: string) => void;
  settings: any;
}

const Playground: React.FC<PlaygroundProps> = ({
  isRecording,
  liveTranscriptionText,
  setLiveTranscriptionText,
  settings
}) => {
  const [testText, setTestText] = useState('Hello, this is a test!');
  const [testResult, setTestResult] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const handleTestTextInjection = async () => {
    setIsTesting(true);
    setTestResult('');
    
    try {
      const result = await invoke('test_text_injection', { testText });
      setTestResult(`✅ ${result}`);
    } catch (error) {
      setTestResult(`❌ ${error}`);
    } finally {
      setIsTesting(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Text Playground</CardTitle>
        <CardDescription>
          Test and practice with VWisper transcription. Try speaking while holding Right Ctrl.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Transcription Area */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="liveText">Live Transcription</Label>
              <textarea
                id="liveText"
                className="mt-2 w-full min-h-[200px] p-4 bg-muted/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                placeholder={isRecording ? "🎤 Listening... Release Right Ctrl when done." : "Click here and hold Right Ctrl to start transcribing. Your speech will appear as text in real-time."}
                readOnly={false}
                value={liveTranscriptionText}
                onChange={(e) => setLiveTranscriptionText(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${settings?.groq_api_key ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {settings?.groq_api_key ? 'API Connected' : 'API Key Required'}
                </span>
              </div>
              <Badge variant="default" className="text-xs">
                Right Ctrl Enabled
              </Badge>
            </div>
          </div>

          {/* Instructions & Tips */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">How to Use</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <span>Open any text editor, document, or text field where you want text to appear</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <span>Click in the text area to position your cursor where you want the text</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <span>Hold down the Right Ctrl key on your keyboard</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">4</span>
                  </div>
                  <span>Start speaking clearly into your microphone</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">5</span>
                  </div>
                  <span>Release Right Ctrl when you're done speaking</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <span className="text-xs font-bold text-primary">6</span>
                  </div>
                  <span>Text will be automatically typed at your cursor location</span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Tips for Better Results</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Speak clearly and at a moderate pace</p>
                <p>• Minimize background noise</p>
                <p>• Use proper punctuation words like "comma", "period"</p>
                <p>• Keep recordings under 30 seconds for best accuracy</p>
                <p>• Ensure your microphone is working properly</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Current Audio Settings</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Sample Rate: {settings?.sample_rate || 16000} Hz</p>
                <p>Volume Threshold: {settings?.volume_threshold || 0.005}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Text Injection Debugging</h4>
              <div className="space-y-2">
                <div className="flex space-x-2">
                  <Input
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Enter test text..."
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleTestTextInjection}
                    disabled={isTesting}
                    variant="outline"
                    size="sm"
                  >
                    {isTesting ? 'Testing...' : 'Test Inject'}
                  </Button>
                </div>
                {testResult && (
                  <div className="text-xs p-2 bg-muted rounded">
                    {testResult}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Click into any text field (like the one above) and then click "Test Inject" to debug text injection on Windows.
                </p>
              </div>
            </div>
          </div>
        </div>

        {!settings?.groq_api_key && (
          <Alert>
            <AlertDescription>
              Configure your Groq API key in the Settings tab to enable transcription functionality.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default Playground;
