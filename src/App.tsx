import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * UI states for the pill component.
 */
enum UIState {
  Recording = "recording",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

/**
 * App-wide constants
 */
const BAR_COUNT = 10;
const BAR_MIN_HEIGHT = 5; // px
const BAR_MAX_HEIGHT = 20; // px
const ICON_EXIT_DURATION = 300; // ms
const RESULT_DISPLAY_DURATION = 1200; // ms

function App() {
  /* ------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------ */
  const [uiState, setUiState] = useState<UIState>(UIState.Recording);
  const [iconsExiting, setIconsExiting] = useState(false);
  const [barHeights, setBarHeights] = useState<number[]>(
    Array(BAR_COUNT).fill(BAR_MIN_HEIGHT)
  );

  /* ------------------------------------------------------------------
   * Derived values
   * ------------------------------------------------------------------ */
  const isIconsVisible =
    (uiState === UIState.Loading || uiState === UIState.Success || uiState === UIState.Error) &&
    !iconsExiting;
  const isBarAnimated = uiState === UIState.Recording;
  const isPillExpanded =
    uiState === UIState.Loading || uiState === UIState.Success || uiState === UIState.Error || iconsExiting;

  /* ------------------------------------------------------------------
   * Effects
   * ------------------------------------------------------------------ */
  // Setup event listeners for backend communication
  useEffect(() => {
    let unlisteners: (() => void)[] = [];

    const setupListeners = async () => {
      // Listen for recording events from backend
      const unlisten1 = await listen("recording-started", () => {
        setUiState(UIState.Recording);
      });

      const unlisten2 = await listen("recording-stopped", () => {
        setUiState(UIState.Loading);
      });

      const unlisten3 = await listen("transcription-completed", (event) => {
        const text = event.payload as string;
        console.log("Transcription completed:", text);
        setUiState(UIState.Success);
        // The text will be injected by the backend (Enigo)
      });

      const unlisten4 = await listen("transcription-error", (event) => {
        const error = event.payload as string;
        console.error("Transcription error:", error);
        setUiState(UIState.Error);
      });

      const unlisten5 = await listen("wave-reset", () => {
        setIconsExiting(false); 
        setUiState(UIState.Recording);
      });

      // Listen for sound events from backend - add debouncing to prevent multiple plays
      let lastSoundTime = 0;
      const SOUND_DEBOUNCE_MS = 100; // Prevent same sound playing within 100ms
      
      const unlisten6 = await listen("play-sound", (event) => {
        const soundName = event.payload as string;
        const now = Date.now();
        
        // Debounce sound playing to prevent duplicates in dev mode
        if (now - lastSoundTime >= SOUND_DEBOUNCE_MS) {
          lastSoundTime = now;
          playSound(soundName);
        } else {
          console.log(`Debounced duplicate ${soundName} sound`);
        }
      });

      unlisteners = [unlisten1, unlisten2, unlisten3, unlisten4, unlisten5, unlisten6];
    };

    setupListeners();

    // Cleanup listeners on unmount to prevent duplicates
    return () => {
      unlisteners.forEach(unlisten => unlisten());
    };
  }, []);

  // Animate bars while recording; stop and reset heights otherwise
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const SENSITIVITY = 5.0; // Increase for more responsive bars

    if (isBarAnimated) {
      // Listen for real-time audio data from backend
      const setupAudioListener = async () => {
        unlisten = await listen<{ samples: number[] }>("audio-data", (event) => {
          const { samples } = event.payload as { samples: number[] };
          if (samples && samples.length > 0) {
            // Map the samples (usually 12) to the number of bars (BAR_COUNT)
            let mapped = samples.slice(0, BAR_COUNT);
            while (mapped.length < BAR_COUNT) mapped.push(0);
            // Scale to bar height range with sensitivity
            const scaled = mapped.map(level => {
              const sensitiveLevel = Math.min(level * SENSITIVITY, 1.0);
              // If the sensitive level is very low, keep the bar at minimum height (dot)
              if (sensitiveLevel < 0.05) return BAR_MIN_HEIGHT;
              return BAR_MIN_HEIGHT + (sensitiveLevel * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT));
            });
            setBarHeights(scaled);
          }
        });
      };
      setupAudioListener();
    } else if (uiState === UIState.Loading) {
      // In loading state, show tiny dots
      setBarHeights(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT));
    } else {
      // Reset bars to minimum height when not animating
      setBarHeights(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT));
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isBarAnimated, uiState]);

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */
  const resetToRecording = () => {
    setIconsExiting(true);
    setTimeout(() => {
      setUiState(UIState.Recording);
      setIconsExiting(false);
    }, ICON_EXIT_DURATION);
  };

  /* Reset to recording after success/error */
  useEffect(() => {
    if (uiState === UIState.Success || uiState === UIState.Error) {
      const t = setTimeout(resetToRecording, RESULT_DISPLAY_DURATION);
      return () => clearTimeout(t);
    }
  }, [uiState]);

  /* ------------------------------------------------------------------
   * Sound Functions
   * ------------------------------------------------------------------ */
  let currentAudio: HTMLAudioElement | null = null; // Track current playing audio

  const playSound = (soundName: string) => {
    try {
      // Stop any currently playing sound to prevent overlapping
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }

      // Use public folder path for Vite
      const soundPath = `/sounds/${soundName}.wav`;
      
      const audio = new Audio(soundPath);
      audio.volume = 0.6;
      currentAudio = audio;
      
      audio.onerror = (error) => {
        console.error(`Failed to load ${soundName} sound:`, error);
        currentAudio = null;
      };
      
      audio.onended = () => {
        currentAudio = null;
      };
      
      audio.play().catch((error) => {
        console.error(`Failed to play ${soundName} sound:`, error);
        currentAudio = null;
      });
      
      console.log(`Playing ${soundName} sound`);
      
    } catch (error) {
      console.error(`Error with ${soundName} sound:`, error);
      currentAudio = null;
    }
  };

  /* ------------------------------------------------------------------
   * Render helpers
   * ------------------------------------------------------------------ */
  const renderLeftIcon = () => {
    if (!isIconsVisible) return null;
    return (
      <button
        aria-label="Stop"
        onClick={resetToRecording}
        className="w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center focus:outline-none transition-transform duration-200"
      >
        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
          <rect x="5" y="5" width="10" height="10" rx="2" />
        </svg>
      </button>
    );
  };

  const renderRightIcon = () => {
    switch (uiState) {
      case UIState.Loading:
        return (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-amber-500 rounded-full animate-spin" />
        );
      case UIState.Success:
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case UIState.Error:
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  /* ------------------------------------------------------------------
   * JSX
   * ------------------------------------------------------------------ */
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      {/* Pill */}
      <div
        className={`bg-black rounded-full flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
          isPillExpanded ? "px-3" : "px-4"
        } py-2`}
        style={{ 
          minWidth: isPillExpanded ? 130 : 110, 
          minHeight: 28, 
          maxWidth: 160,
          // Add extra margin on macOS to ensure no cutoff - increased margin
          margin: '0 20px'
        }}
      >
        {/* Left Icon */}
        <div
          className={`flex items-center justify-center transition-all duration-300 ${
            isIconsVisible || iconsExiting
              ? iconsExiting
                ? "opacity-0 translate-x-3 pointer-events-none"
                : "opacity-100 translate-x-0 ml-0 mr-1.5"
              : "opacity-0 -translate-x-3 ml-[-20px] mr-0 pointer-events-none"
          }`}
          style={{ width: 20, height: 20 }}
        >
          {renderLeftIcon()}
        </div>

        {/* Audio Bars */}
        <div className="relative" style={{ width: BAR_COUNT * 6, height: 24 }}>
          {barHeights.map((h, i) => (
            <div
              key={i}
              className={`bg-white rounded-full transition-all duration-200 absolute left-0 ${
                isBarAnimated ? "" : "opacity-60"
              }`}
              style={{
                width: 4,
                height: h,
                left: i * 6,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
          ))}
        </div>

        {/* Right Icon */}
        <div
          className={`flex items-center justify-center transition-all duration-300 ${
            isIconsVisible || iconsExiting
              ? iconsExiting
                ? "opacity-0 -translate-x-3 pointer-events-none"
                : "opacity-100 translate-x-0 ml-1.5 mr-0"
              : "opacity-0 translate-x-3 mr-[-20px] ml-0 pointer-events-none"
          }`}
          style={{ width: 20, height: 20 }}
        >
          {renderRightIcon()}
        </div>
      </div>
    </main>
  );
}

export default App;