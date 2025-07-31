"use client"

import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import useAudioPillState from "../../lib/AudioPillState"
import VoiceVisualizer from "../../components/AudioPill/VoiceVisualizer"
import { invoke } from "@tauri-apps/api/core"

export default function AudioPill() {
  const { state, visible } = useAudioPillState()

  const handleStop = async () => {
    try {
      console.log('Stop recording requested')
      await invoke('manual_stop_recording')
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  if (!visible) return null

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent">
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center bg-black text-white rounded-full transition-all duration-300 shadow-lg relative",
            state === "idle" && "px6 py-2",
            state === "listening" && "px-6 py-2",
            state === "loading" && "px-11 py-2",
            state === "error" && "bg-red-600 px-6 py-2"
          )}
        >
          {state === "error" && (
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">Error</span>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          )}

          <div
            className={cn(
              "absolute right-3 transition-opacity duration-300",
              state === "loading" ? "opacity-100" : "opacity-0",
            )}
          >
            <div className="w-5 h-5 border-[1.5px] border-white border-t-transparent rounded-full animate-spin" />
          </div>
          {state === "loading" && (
            <div
              className="absolute left-3 cursor-pointer"
              onClick={handleStop}
              title="Stop recording"
            >
              <X className="w-5 h-5 text-red-500 hover:text-red-400" />
            </div>
          )}
          {state !== "error" && <VoiceVisualizer />}
        </div>

      </div>
    </div>
  )
}
