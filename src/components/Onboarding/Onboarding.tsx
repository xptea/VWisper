import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, ArrowRight, ArrowLeft, Shield, Key, Mic, Zap } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [platform, setPlatform] = useState<string>("");
  const [hasAccessibilityPermission, setHasAccessibilityPermission] = useState(false);
  const [isCheckingAccessibility, setIsCheckingAccessibility] = useState(false);

  // Detect platform and check accessibility permission on mount
  useEffect(() => {
    const detectPlatform = async () => {
      try {
        const detectedPlatform = await invoke<string>("get_platform");
        setPlatform(detectedPlatform);
        
        if (detectedPlatform === "macos") {
          const hasPermission = await invoke<boolean>("check_accessibility_permission");
          setHasAccessibilityPermission(hasPermission);
        }
      } catch (error) {
        console.error("Failed to detect platform:", error);
      }
    };
    
    detectPlatform();
  }, []);

  // Define steps based on platform
  const getSteps = (): Step[] => {
    const baseSteps: Step[] = [
      {
        id: "welcome",
        title: "Welcome to VWisper",
        description: "Transform your voice into text with lightning-fast AI transcription.",
        icon: Mic,
      },
      {
        id: "api-key",
        title: "API Key Setup",
        description: "Enter your Groq API key to enable transcription.",
        icon: Key,
      },
    ];

    // Add macOS accessibility step if on macOS
    if (platform === "macos") {
      baseSteps.push({
        id: "accessibility",
        title: "Accessibility Permission",
        description: "Grant permission for VWisper to type text into other applications.",
        icon: Shield,
      });
    }

    baseSteps.push(
      {
        id: "test",
        title: "Test Setup",
        description: "Verify everything is working correctly.",
        icon: CheckCircle,
      },
      {
        id: "ready",
        title: "You're All Set!",
        description: "Start transcribing with your voice.",
        icon: Zap,
      }
    );

    return baseSteps;
  };

  const steps = getSteps();

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    setIsValidating(true);
    try {
      const isValid = await invoke<boolean>("test_groq_api_key", { apiKey: apiKey.trim() });
      if (isValid) {
        toast.success("API key is valid!");
        handleNext();
      } else {
        toast.error("Invalid API key. Please check and try again.");
      }
    } catch (error) {
      toast.error("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  const saveApiKey = async () => {
    try {
      await invoke("save_settings", {
        settings: {
          groq_api_key: apiKey.trim(),
          shortcut_enabled: true,
          auto_start: false,
          save_history: true,
        },
      });
      toast.success("API key saved successfully!");
      handleNext();
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key");
    }
  };

  const checkAccessibilityPermission = async () => {
    setIsCheckingAccessibility(true);
    try {
      const hasPermission = await invoke<boolean>("check_accessibility_permission");
      setHasAccessibilityPermission(hasPermission);
      if (hasPermission) {
        toast.success("Accessibility permission granted!");
        handleNext();
      } else {
        toast.error("Accessibility permission not granted. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to check accessibility permission");
    } finally {
      setIsCheckingAccessibility(false);
    }
  };

  const requestAccessibilityPermission = async () => {
    try {
      await invoke("request_accessibility_permission");
      toast.success("Accessibility permission requested. Please grant permission in System Preferences and restart the app.");
      // The app will need to be restarted after permission is granted
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      toast.error("Failed to request accessibility permission");
    }
  };



  const finishOnboarding = async () => {
    try {
      await invoke("save_settings", {
        settings: {
          has_seen_splash: true,
        },
      });
      onComplete();
    } catch (error) {
      console.error("Failed to complete setup:", error);
      toast.error("Failed to complete setup");
    }
  };

  const renderStep = () => {
    const step = steps[currentStep];
    const IconComponent = step.icon;

    switch (step.id) {
      case "welcome":
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-3xl font-bold">{step.title}</CardTitle>
                <CardDescription className="text-lg">{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                  <Zap className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Lightning Fast</h3>
                    <p className="text-sm text-muted-foreground">Powered by Groq's ultra-fast AI models</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                  <Shield className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Privacy First</h3>
                    <p className="text-sm text-muted-foreground">Your audio is processed securely</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                  <Key className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Global Shortcuts</h3>
                    <p className="text-sm text-muted-foreground">Start recording from anywhere</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border bg-card">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Smart Analytics</h3>
                    <p className="text-sm text-muted-foreground">Track usage and view history</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "api-key":
        return (
          <Card className="w-full max-w-lg mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="api-key">Groq API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoFocus
                />
                <p className="text-sm text-muted-foreground">
                  Your API key is stored locally and never shared.
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={testApiKey} 
                  disabled={isValidating || !apiKey.trim()} 
                  className="flex-1"
                >
                  {isValidating ? "Validating..." : "Test Key"}
                </Button>
                <Button 
                  onClick={saveApiKey} 
                  disabled={!apiKey.trim()} 
                  variant="outline" 
                  className="flex-1"
                >
                  Save & Continue
                </Button>
              </div>

              <Separator />

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={async () => {
                    try {
                      await invoke("open_url", { url: "https://console.groq.com/keys" });
                    } catch (error) {
                      console.error("Failed to open URL:", error);
                      toast.error("Failed to open browser");
                    }
                  }}
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium p-0 h-auto"
                >
                  Get your free API key from Groq Console
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case "accessibility":
        return (
          <Card className="w-full max-w-lg mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  VWisper needs accessibility permission to type transcribed text into other applications. 
                  This permission is required for the app to function properly on macOS.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    {hasAccessibilityPermission ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">Accessibility Permission</p>
                      <p className="text-sm text-muted-foreground">
                        {hasAccessibilityPermission 
                          ? "Permission granted" 
                          : "Permission required"
                        }
                      </p>
                    </div>
                  </div>
                  <Badge variant={hasAccessibilityPermission ? "default" : "secondary"}>
                    {hasAccessibilityPermission ? "Granted" : "Required"}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={checkAccessibilityPermission} 
                  disabled={isCheckingAccessibility}
                  className="flex-1"
                >
                  {isCheckingAccessibility ? "Checking..." : "Check Permission"}
                </Button>
                {!hasAccessibilityPermission && (
                  <Button 
                    onClick={requestAccessibilityPermission} 
                    variant="outline" 
                    className="flex-1"
                  >
                    Request Permission
                  </Button>
                )}
              </div>

              {hasAccessibilityPermission && (
                <Button onClick={handleNext} className="w-full">
                  Continue
                </Button>
              )}
            </CardContent>
          </Card>
        );

      case "test":
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Let's test your speech-to-text setup! Open a text editor and try recording some speech.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Test Instructions */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Test Instructions</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">1</Badge>
                      <div>
                        <p className="font-medium">Open a text editor</p>
                        <p className="text-sm text-muted-foreground">Open Notes, TextEdit, or any text input field</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">2</Badge>
                      <div>
                        <p className="font-medium">Use the global shortcut</p>
                        <p className="text-sm text-muted-foreground">
                          Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Right Ctrl</kbd> (or <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Control</kbd> on Mac)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">3</Badge>
                      <div>
                        <p className="font-medium">Speak clearly</p>
                        <p className="text-sm text-muted-foreground">Say something like "Hello, this is a test of VWisper"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">4</Badge>
                      <div>
                        <p className="font-medium">Release the shortcut</p>
                        <p className="text-sm text-muted-foreground">Your speech will be transcribed and appear in the text editor</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Test Preview */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">What to Expect</h4>
                  <div className="space-y-3">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Recording Process</p>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        When you press the shortcut, you'll see a wave window appear showing audio levels. 
                        Speak clearly and release the shortcut when done.
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">Expected Result</p>
                      </div>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Your spoken words should appear as text in your active text editor or input field.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Try it now! Open a text editor and use the global shortcut to test speech-to-text.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span>Shortcut:</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                      {platform === "macos" ? "Control" : "Right Ctrl"}
                    </kbd>
                  </div>
                </div>

                <div className="text-center">
                  <Button 
                    onClick={handleNext} 
                    className="w-full max-w-md"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Continue to Next Step
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case "ready":
        return (
          <Card className="w-full max-w-lg mx-auto">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                <IconComponent className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-bold">{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">1</Badge>
                  <div>
                    <h4 className="font-semibold">Use the global shortcut</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Right Ctrl</kbd> (or <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Control</kbd> on Mac) to start recording
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">2</Badge>
                  <div>
                    <h4 className="font-semibold">Speak clearly</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      The wave window will show your audio levels while recording
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Badge variant="secondary" className="mt-1 w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs font-bold">3</Badge>
                  <div>
                    <h4 className="font-semibold">Text is automatically injected</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your transcribed text will appear in the active application
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  You can customize shortcuts and settings in the Settings tab.
                </AlertDescription>
              </Alert>

              <Button onClick={finishOnboarding} className="w-full">
                Get Started
              </Button>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  idx <= currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                    idx < currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <p className="text-sm text-muted-foreground text-center font-medium">
          Step {currentStep + 1} of {steps.length}
        </p>

        {/* Step content */}
        <div className="flex justify-center">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={handleBack} 
            disabled={currentStep === 0}
            className="px-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          {currentStep < steps.length - 1 && steps[currentStep].id !== "accessibility" && (
            <Button
              onClick={handleNext}
              disabled={
                (steps[currentStep].id === "api-key" && !apiKey.trim())
              }
              className="px-8"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 