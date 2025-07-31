
"use client"
import { useEffect, useRef, useState } from "react"
import useAudioPillState from "../../lib/AudioPillState"

const BAR_COUNT = 10
const BAR_MIN_HEIGHT = 6
const BAR_MAX_HEIGHT = 24
const SENSITIVITY = 2.0

export default function VoiceVisualizer() {
  const { state } = useAudioPillState()
  const [barHeights, setBarHeights] = useState<number[]>(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT))
  const [isBarAnimated, setIsBarAnimated] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.1
        source.connect(analyser)
        analyserRef.current = analyser
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        function animate() {
          if (cancelled) return
          if (analyserRef.current && state === "listening") {
            analyserRef.current.getByteFrequencyData(dataArray)
            
            // Calculate overall volume (RMS)
            let sum = 0
            for (let i = 0; i < dataArray.length; i++) {
              sum += (dataArray[i] || 0) ** 2
            }
            const rms = Math.sqrt(sum / dataArray.length)
            const volume = Math.min(rms / 255, 1.0)
            
            // Create human-like bar heights based on volume
            const baseHeight = BAR_MIN_HEIGHT + (volume * SENSITIVITY * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT))
            const newHeights = Array(BAR_COUNT).fill(0).map((_, i) => {
              // Add some randomization to make it look more natural
              const randomFactor = 0.7 + Math.random() * 0.6 // 0.7 to 1.3
              const centerBias = Math.cos((i - BAR_COUNT / 2) * 0.3) * 0.2 + 1 // Slight center bias
              const height = baseHeight * randomFactor * centerBias
              return Math.max(BAR_MIN_HEIGHT, Math.min(BAR_MAX_HEIGHT, height))
            })
            
            setBarHeights(newHeights)
            setIsBarAnimated(volume > 0.1)
          } else if (state === "loading") {
            // During loading, keep bars at minimum height
            setBarHeights(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT))
            setIsBarAnimated(false)
          }
          animationRef.current = requestAnimationFrame(animate)
        }
        animate()
      } catch (e) {
        setBarHeights(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT))
        setIsBarAnimated(false)
      }
    }

    if (state === "listening" || state === "loading") {
      setup()
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      setBarHeights(Array(BAR_COUNT).fill(BAR_MIN_HEIGHT))
      setIsBarAnimated(false)
    }
    return () => {
      cancelled = true
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [state])

  if (state !== "listening" && state !== "loading") {
    return null
  }

  return (
    <div className="relative" style={{ width: BAR_COUNT * 6, height: 24 }}>
      {barHeights.map((h, i) => (
        <div
          key={i}
          className={`bg-white rounded-full transition-all duration-75 absolute left-0 ${isBarAnimated ? "" : "opacity-60"}`}
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
  )
}
