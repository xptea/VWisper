import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { invoke } from '@tauri-apps/api/core';
import { 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle, 
  ExternalLink, 
  Key, 
  Type, 
  Zap,
  Eye,
  EyeOff,
  Loader2,
  TestTube,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import iconPath from '../../assets/icon.png';

interface OnboardingProps {
  onComplete: (apiKey: string) => void;
  onTestApiKey: (apiKey: string) => Promise<boolean>;
  openGroqConsole: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onTestApiKey, openGroqConsole }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [isMac, setIsMac] = useState(false);
  const [accessibilityGranted, setAccessibilityGranted] = useState(false);

  const steps = useMemo(() => [
    {
      id: 'welcome',
      title: 'Welcome to VWisper',
      description: 'Transform your voice into text instantly'
    },
    {
      id: 'how-it-works',
      title: 'How VWisper Works',
      description: 'Learn the simple process'
    },
    {
      id: 'api-setup',
      title: 'Setup API Key',
      description: 'Configure your transcription service'
    },
    {
      id: 'test-setup',
      title: 'Test Your Setup',
      description: 'Verify everything is working'
    },
    ...(isMac ? [{
      id: 'mac-permissions',
      title: 'Mac Permissions',
      description: 'Enable accessibility for typing'
    }] : []),
    {
      id: 'ready',
      title: 'You\'re All Set!',
      description: 'Start using VWisper'
    }
  ], [isMac]);

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) {
      setTestResult(false);
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      const isValid = await onTestApiKey(apiKey);
      setTestResult(isValid);
    } catch (error) {
      console.error('API test failed:', error);
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  };

  const handleComplete = async () => {
    if (testResult && apiKey.trim()) {
      // If we're on Mac and this is the final step, restart the app
      if (isMac && currentStep === steps.length - 1) {
        await onComplete(apiKey);
        // Give a brief moment for settings to save
        setTimeout(async () => {
          await restartApp();
        }, 500);
      } else {
        onComplete(apiKey);
      }
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    const currentStepId = steps[currentStep]?.id;
    
    switch (currentStepId) {
      case 'api-setup': // API setup step
        return apiKey.trim().length > 0;
      case 'test-setup': // Test setup step
        return testResult === true;
      case 'mac-permissions': // Mac permissions step (only exists on Mac)
        return accessibilityGranted;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    const currentStepId = steps[currentStep]?.id;
    
    switch (currentStepId) {
      case 'welcome': // Welcome
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <img src={iconPath} alt="VWisper" className="w-24 h-24" />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Welcome to VWisper</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                VWisper is your powerful voice-to-text companion that transforms spoken words into written text instantly. 
                Perfect for note-taking, documentation, and any writing task.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="flex flex-col items-center space-y-2 p-4 bg-muted/30 rounded-lg">
                <Zap className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Get transcriptions in under a second (avg ~700ms)
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-4 bg-muted/30 rounded-lg">
                <Key className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Simple Shortcut</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Just hold Right CTRL (or control on Mac) to record
                </p>
              </div>
              <div className="flex flex-col items-center space-y-2 p-4 bg-muted/30 rounded-lg">
                <Type className="w-8 h-8 text-primary" />
                <h3 className="font-semibold">Auto-Type</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Text appears in any text field system-wide
                </p>
              </div>
            </div>
          </div>
        );

      case 'how-it-works': // How it works
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">How VWisper Works</h2>
              <p className="text-muted-foreground">
                Using VWisper is as simple as speaking. Here's how:
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Focus on Any Text Field</h3>
                  <p className="text-muted-foreground">
                    Click in any text field, document, or application where you want text to appear - works system-wide.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Hold the Shortcut Key</h3>
                  <p className="text-muted-foreground">
                    Press and hold <Badge variant="outline" className="mx-1">Right CTRL</Badge> on Windows/Linux or <Badge variant="outline" className="mx-1">control</Badge> on Mac
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Speak Naturally</h3>
                  <p className="text-muted-foreground">
                    Talk normally while holding the key. No need to speak slowly or robotically.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Release and Watch the Magic</h3>
                  <p className="text-muted-foreground">
                    Let go of the key and your words will automatically appear as text in whatever text field you're focused on.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Pro Tip</h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                Keep recordings under 30 seconds for the best accuracy. For longer content, simply use multiple short recordings.
              </p>
            </div>
          </div>
        );

      case 'api-setup': // API Setup
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">Setup Your API Key</h2>
              <p className="text-muted-foreground">
                VWisper uses Groq's free API for lightning-fast transcription. You'll need a free API key to continue.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>Groq API Key</span>
                </CardTitle>
                <CardDescription>
                  Get your free API key from Groq Console. No credit card required!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboarding-api-key">API Key</Label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Input
                        id="onboarding-api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Groq API key (gsk_...)"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={openGroqConsole}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Get Free API Key from Groq Console
                </Button>

                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🔑 How to get your API key:</h4>
                  <ol className="text-amber-800 dark:text-amber-200 text-sm space-y-1 list-decimal list-inside">
                    <li>Click the button above to open Groq Console</li>
                    <li>Sign up with your email (it's free!)</li>
                    <li>Go to the API Keys section</li>
                    <li>Click "Create API Key"</li>
                    <li>Copy the key and paste it above</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'test-setup': // Test Setup
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">Test Your Setup</h2>
              <p className="text-muted-foreground">
                Let's make sure your API key is working correctly before we continue.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TestTube className="w-5 h-5" />
                  <span>API Key Test</span>
                </CardTitle>
                <CardDescription>
                  We'll verify your API key can connect to Groq's servers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">API Key:</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'No key entered'}
                    </p>
                  </div>
                  <Button
                    onClick={handleTestApiKey}
                    disabled={testing || !apiKey.trim()}
                    variant="outline"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>

                {testResult !== null && (
                  <div className={`flex items-center space-x-2 ${testResult ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {testResult ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {testResult 
                        ? 'Perfect! Your API key is working correctly.' 
                        : 'API key test failed. Please check your key and try again.'
                      }
                    </span>
                  </div>
                )}

                {!testResult && testResult !== null && (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Common issues:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Make sure the API key starts with "gsk_"</li>
                      <li>Check that you copied the entire key</li>
                      <li>Verify your internet connection</li>
                      <li>Try generating a new API key if the issue persists</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'mac-permissions': // Mac Permissions (only on Mac)
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">Mac Accessibility Permission</h2>
              <p className="text-muted-foreground">
                VWisper needs accessibility permission to type text into other applications on your Mac.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="w-5 h-5" />
                  <span>Accessibility Access</span>
                </CardTitle>
                <CardDescription>
                  This allows VWisper to automatically type your transcribed text wherever you want it
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">Accessibility Permission:</p>
                    <p className="text-sm text-muted-foreground">
                      {accessibilityGranted ? 'Granted ✅' : 'Not granted yet'}
                    </p>
                  </div>
                  <Button
                    onClick={requestAccessibilityPermission}
                    disabled={accessibilityGranted}
                    variant="outline"
                  >
                    {accessibilityGranted ? 'Permission Granted' : 'Grant Permission'}
                  </Button>
                </div>

                {accessibilityGranted ? (
                  <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Perfect! Accessibility permission has been granted.
                    </span>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🔐 How to grant accessibility permission:</h4>
                    <ol className="text-amber-800 dark:text-amber-200 text-sm space-y-1 list-decimal list-inside">
                      <li>Click "Grant Permission" above to open System Preferences</li>
                      <li>In Security & Privacy → Privacy → Accessibility</li>
                      <li>Click the lock icon and enter your password</li>
                      <li>Find VWisper in the list and check the box next to it</li>
                      <li>Return to this app - it should detect the change</li>
                    </ol>
                  </div>
                )}

                <Alert>
                  <AlertDescription>
                    <strong>Important:</strong> After granting permission, VWisper will automatically restart to apply the changes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        );

      case 'ready': // Ready
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">You're All Set!</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                VWisper is now configured and ready to transform your voice into text. 
                {isMac 
                  ? 'VWisper will restart automatically to apply the accessibility permissions, then you can start using it!'
                  : 'Start by trying the playground or jump right into using it with any application.'
                }
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6 max-w-lg mx-auto">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Quick Reminder:</h3>
              <div className="text-blue-800 dark:text-blue-200 text-sm space-y-2 text-left">
                <p>1. Focus on any text field in any application</p>
                <p>2. Hold <Badge variant="outline" className="mx-1">Right CTRL</Badge> (or <Badge variant="outline" className="mx-1">control</Badge> on Mac)</p>
                <p>3. Speak naturally</p>
                <p>4. Release the key and watch your words appear!</p>
              </div>
            </div>

            <div className="flex justify-center space-x-4 pt-4">
              <Button onClick={handleComplete} size="lg" className="px-8">
                <Type className="w-5 h-5 mr-2" />
                {isMac ? 'Complete Setup & Restart' : 'Start Using VWisper'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  useEffect(() => {
    // Detect if we're on Mac
    const checkPlatform = async () => {
      try {
        const platform = await invoke<string>('get_platform');
        setIsMac(platform === 'macos');
      } catch (error) {
        console.error('Failed to detect platform:', error);
        // Fallback to user agent detection
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    
    checkPlatform();
  }, []);

  // Check accessibility permission periodically when on Mac permissions step
  useEffect(() => {
    const currentStepId = steps[currentStep]?.id;
    if (isMac && currentStepId === 'mac-permissions') { // Mac permissions step
      const checkPermission = async () => {
        await checkAccessibilityPermission();
      };
      
      // Check immediately
      checkPermission();
      
      // Then check every 2 seconds
      const interval = setInterval(checkPermission, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isMac, currentStep, steps]);

  const checkAccessibilityPermission = async () => {
    try {
      const hasPermission = await invoke<boolean>('check_accessibility_permission');
      setAccessibilityGranted(hasPermission);
      return hasPermission;
    } catch (error) {
      console.error('Failed to check accessibility permission:', error);
      return false;
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      await invoke('request_accessibility_permission');
      // Check again after request
      setTimeout(async () => {
        const granted = await checkAccessibilityPermission();
        setAccessibilityGranted(granted);
      }, 1000);
    } catch (error) {
      console.error('Failed to request accessibility permission:', error);
    }
  };

  const restartApp = async () => {
    try {
      await invoke('restart_app');
    } catch (error) {
      console.error('Failed to restart app:', error);
      // Fallback: just close the app
      try {
        await invoke('close_app');
      } catch (closeError) {
        console.error('Failed to close app:', closeError);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(((currentStep + 1) / steps.length) * 100)}%
            </span>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className={`text-xs text-center ${index <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {step.title}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <Card className="min-h-[500px]">
          <CardContent className="p-8">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 0}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </Button>

          <div className="flex space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep ? 'bg-primary' : 
                  index < currentStep ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center space-x-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={!canProceed()}
              className="flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Setup</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
