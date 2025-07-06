import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "./WaveWindow.css";

interface AudioData {
  samples: number[];
  volume: number;
}

const BubbleWindow = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isReceivingAudio, setIsReceivingAudio] = useState(false);
  const [audioData, setAudioData] = useState<AudioData>({ samples: [], volume: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Listen for audio data from Rust backend
    const unlistenAudio = listen<AudioData>("audio-data", (event) => {
      setAudioData(event.payload);
      setIsReceivingAudio(true);
    });

    // Listen for processing events
    const unlistenExpand = listen("expand-for-processing", () => {
      setIsProcessing(true);
    });

    const triggerExit = () => {
      // Collapse bubble then hide entire Tauri window after the transition
      setIsProcessing(false);
      setTimeout(() => {
        invoke('hide_wave_window').catch(() => {});
      }, 350); // matches CSS transition duration (300ms) + small buffer
    };

    const unlistenCompleted = listen<string>("transcription-completed", triggerExit);

    const unlistenError = listen<string>("transcription-error", triggerExit);

    const unlistenCancelled = listen("transcription-cancelled", triggerExit);

    // Reset bubble state when backend asks
    const unlistenReset = listen("wave-reset", () => {
      setIsProcessing(false);
    });

    return () => {
      unlistenAudio.then(fn => fn());
      unlistenExpand.then(fn => fn());
      unlistenCompleted.then(fn => fn());
      unlistenError.then(fn => fn());
      unlistenCancelled.then(fn => fn());
      unlistenReset.then(fn => fn());
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
      
      const barCount = 10;
      const barWidth = 4;
      const spacing = 1;
      const totalWidth = (barCount * barWidth) + ((barCount - 1) * spacing);
      const startX = (width - totalWidth) / 2;
      
      if (!isReceivingAudio || audioData.samples.length === 0) {
        // Draw idle state with exactly 10 small bars
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        for (let i = 0; i < barCount; i++) {
          const x = startX + (i * (barWidth + spacing));
          const barHeight = 3;
          const y = (height - barHeight) / 2;
          ctx.fillRect(x, y, barWidth, barHeight);
        }
        return;
      }

      // Use exactly 10 samples from the audio data
      const samples = audioData.samples.slice(0, 10);
      
      // Create gradient with white colors
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0.8)");
      
      ctx.fillStyle = gradient;

      // Draw exactly 10 bars
      for (let i = 0; i < barCount && i < samples.length; i++) {
        const sample = Math.abs(samples[i]);
        const barHeight = Math.max(3, sample * height * 0.7);
        const x = startX + (i * (barWidth + spacing));
        const y = (height - barHeight) / 2;
        
        // Draw bar
        ctx.fillRect(x, y, barWidth, barHeight);
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
  }, [isReceivingAudio, audioData]);

  return (
    <div className="bubble-container">
      <div className={`bubble ${isProcessing ? 'processing' : ''}`}>
        <div className="audio-section">
          <canvas
            ref={canvasRef}
            width={70}
            height={24}
            className="waveform-canvas"
          />
        </div>
        {isProcessing && (
          <div className="processing-section">
            <div className="loading-spinner"></div>
          </div>
        )}
        {/* Cancel button (only during processing) */}
        {isProcessing && (
          <div className="cancel-section" onClick={() => invoke('cancel_processing')}>
            <div className="cancel-icon"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BubbleWindow; 