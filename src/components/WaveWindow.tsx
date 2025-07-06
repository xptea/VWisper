import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./WaveWindow.css";

interface AudioData {
  samples: number[];
  volume: number;
}

type ProcessingState = 'idle' | 'recording' | 'expanding' | 'processing' | 'completed' | 'error' | 'leaving';

const BubbleWindow = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [audioData, setAudioData] = useState<AudioData>({ samples: [], volume: 0 });
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [loadingProgress] = useState(0);

  // Helper to draw bars based on current audioData
  const drawRecordingBars = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const barCount = 8;
    const barWidth = 3;
    const spacing = 2;
    const totalWidth = (barCount * barWidth) + ((barCount - 1) * spacing);
    const startX = (width - totalWidth) / 2;
    const samples = [...audioData.samples.slice(0, barCount)];
    while (samples.length < barCount) {
      samples.push(0);
    }
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.6)");
    ctx.fillStyle = gradient;
    for (let i = 0; i < barCount; i++) {
      const sample = Math.abs(samples[i]);
      const barHeight = Math.max(3, sample * height * 0.8);
      const x = startX + (i * (barWidth + spacing));
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  useEffect(() => {
    // Listen for audio data from Rust backend
    const unlistenAudio = listen<AudioData>("audio-data", (event) => {
      setAudioData(event.payload);
      setIsReceivingAudio(true);
    });

    const unlistenRecordingStarted = listen("recording-started", () => {
      setProcessingState('recording');
    });

    const unlistenRecordingStopped = listen("recording-stopped", () => {
      setIsReceivingAudio(false);
    });

    const unlistenExpandForProcessing = listen("expand-for-processing", () => {
      setProcessingState('expanding');
      // After animation, start processing
      setTimeout(() => {
        setProcessingState('processing');
      }, 300); // Match CSS transition duration
    });

    const unlistenTranscriptionStarted = listen("transcription-started", () => {
      setProcessingState('processing');
    });

    const unlistenTranscriptionCompleted = listen<string>("transcription-completed", () => {
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      setProcessingState('completed');
      setTimeout(() => {
        // start leaving animation
        setProcessingState('leaving');
        // hide Tauri window after animation
        setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('hide_wave_window');
          }).catch(() => {});
          // reset state
          setProcessingState('idle');
          setIsReceivingAudio(false);
          setAudioData({ samples: [], volume: 0 });
        }, 400);
      }, 1500);
    });

    const unlistenReset = listen("wave-reset", () => {
      setProcessingState('idle');
      setIsReceivingAudio(false);
      setAudioData({ samples: [], volume: 0 });
    });

    const unlistenTranscriptionError = listen<string>("transcription-error", () => {
      // Clear progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      setProcessingState('error');
      setTimeout(() => {
        // start leaving animation
        setProcessingState('leaving');
        setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('hide_wave_window');
          }).catch(() => {});
          setProcessingState('idle');
        }, 400);
      }, 2000);
    });

    return () => {
      // Clean up intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      unlistenAudio.then(fn => fn());
      unlistenRecordingStarted.then(fn => fn());
      unlistenRecordingStopped.then(fn => fn());
      unlistenExpandForProcessing.then(fn => fn());
      unlistenTranscriptionStarted.then(fn => fn());
      unlistenTranscriptionCompleted.then(fn => fn());
      unlistenReset.then(fn => fn());
      unlistenTranscriptionError.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    const drawWaveform = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw based on processing state
      if (processingState === 'processing') {
        // Draw static bars (reuse recording drawing for bars)
        drawRecordingBars(ctx, width, height);

        // Draw loading circle on the right
        const circleX = width - 18;
        const circleY = height / 2;
        const radius = 8;
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(circleX, circleY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Animated part
        const angle = (Date.now() / 5) % 360;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(circleX, circleY, radius, (angle * Math.PI) / 180, ((angle + 90) * Math.PI) / 180);
        ctx.stroke();
        
        return;
      }
      
      if (processingState === 'expanding') {
        // Show a simple animation during expansion
        ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Processing...", width / 2, height / 2 + 3);
        return;
      }
      
      if (processingState === 'completed') {
        // Draw checkmark
        ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("✓", width / 2, height / 2 + 5);
        return;
      }
      
      if (processingState === 'error') {
        // Draw error indicator
        ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("✗", width / 2, height / 2 + 5);
        return;
      }
      
      // Recording visualization (bars live)
      if (processingState === 'recording') {
        const barCount = 8;
        const barWidth = 3;
        const spacing = 2;
        const totalWidth = (barCount * barWidth) + ((barCount - 1) * spacing);
        const startX = (width - totalWidth) / 2;
        
        if (!isReceivingAudio || audioData.samples.length === 0) {
          // Draw idle bars
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          for (let i = 0; i < barCount; i++) {
            const x = startX + (i * (barWidth + spacing));
            const barHeight = 2;
            const y = (height - barHeight) / 2;
            ctx.fillRect(x, y, barWidth, barHeight);
          }
          return;
        }

        // Use samples from the audio data
        const samples = [...audioData.samples.slice(0, barCount)];
        while (samples.length < barCount) {
          samples.push(0);
        }
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.9)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.6)");
        
        ctx.fillStyle = gradient;

        // Draw bars that fill most of the height
        for (let i = 0; i < barCount && i < samples.length; i++) {
          const sample = Math.abs(samples[i]);
          const barHeight = Math.max(3, sample * height * 0.8); // Fill more of the height
          const x = startX + (i * (barWidth + spacing));
          const y = (height - barHeight) / 2;
          
          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }
    };

    const animate = () => {
      drawWaveform();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isReceivingAudio, audioData, processingState, loadingProgress]);

  // Tailwind-based layout -----------------------------
  const isExpanded = ['processing', 'expanding', 'completed', 'error'].includes(processingState);
  const isLeaving = processingState === 'leaving';

  // Right-side width: 0 when collapsed, 8 (32 px) when expanded
  const rightWidth = isExpanded ? 'w-8' : 'w-0';

  // Bubble translation to keep left edge fixed while expanding
  const initialWidth = 70; // px (approx canvas + padding)
  const expandedWidth = initialWidth + 40; // px (canvas + right side)
  const delta = expandedWidth - initialWidth;
  const translateX = isExpanded ? `${delta / 2}px` : '0px';

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-5 pointer-events-none select-none">
      <div
        className={`flex bg-black/70 rounded-full overflow-hidden transition-all duration-300 pl-2 pr-1 py-1 items-center ${isLeaving ? 'opacity-0 translate-x-4' : ''}`}
        style={{ transform: `translateX(${translateX})` }}
      >
        {/* Audio bars canvas - fixed size to avoid shifting */}
        <canvas
          ref={canvasRef}
          width={50}
          height={24}
          className="w-12 h-6"
        />

        {/* Right-side dynamic area */}
        <div className={`flex items-center justify-center transition-all duration-300 overflow-hidden ${rightWidth}`}>
          {processingState === 'processing' && (
            <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {processingState === 'completed' && (
            <span className="text-green-400 text-lg">✓</span>
          )}
          {processingState === 'error' && (
            <span className="text-red-500 text-lg">✗</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BubbleWindow; 