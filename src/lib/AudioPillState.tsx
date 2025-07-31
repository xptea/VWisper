import { useEffect, useState, useRef } from "react"
import { Window } from "@tauri-apps/api/window"
import { soundManager } from "./sound"

type AudioPillState = "idle" | "listening" | "loading" | "error" | "success"

type UnlistenFn = () => void

const appWindow = new Window('main')

export default function useAudioPillState() {
  const [state, setState] = useState<AudioPillState>("idle")
  const [visible, setVisible] = useState(false)
  const [holdTime, setHoldTime] = useState<number | null>(null)
  const previousState = useRef<AudioPillState>("idle")

  useEffect(() => {
    appWindow.isVisible().then((isVisible: boolean) => {
      if (isVisible) {
        setState("listening")
        setVisible(true)
      } else {
        setState("idle")
        setVisible(false)
      }
    })
    let unlistenPill: UnlistenFn | undefined
    let unlistenHoldTime: UnlistenFn | undefined
    appWindow.listen<string>("pill-state", (event) => {
      const newState = event.payload as AudioPillState
      setState(newState)
      setVisible(newState !== "idle")
    }).then((fn: UnlistenFn) => { unlistenPill = fn })
    
    appWindow.listen<number>("hold-time", (event) => {
      setHoldTime(event.payload)
    }).then((fn: UnlistenFn) => { unlistenHoldTime = fn })
    
    return () => {
      if (unlistenPill) unlistenPill()
      if (unlistenHoldTime) unlistenHoldTime()
    }
  }, [])

  useEffect(() => {
    if (previousState.current !== state) {
      if (state === "listening" && previousState.current === "idle") {
        soundManager.playStart()
      } else if (state === "idle" && (previousState.current === "loading" || previousState.current === "success")) {
        soundManager.playEnding()
      } else if (state === "error") {
        soundManager.playError()
      }
      previousState.current = state
    }
  }, [state])

  return { state, visible, holdTime }
}
