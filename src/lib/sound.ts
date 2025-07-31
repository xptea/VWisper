class SoundManager {
  private startSound: HTMLAudioElement
  private endingSound: HTMLAudioElement
  private errorSound: HTMLAudioElement

  constructor() {
    this.startSound = new Audio('/sounds/start.wav')
    this.endingSound = new Audio('/sounds/ending.wav')
    this.errorSound = new Audio('/sounds/error.wav')
    
    this.startSound.preload = 'auto'
    this.endingSound.preload = 'auto'
    this.errorSound.preload = 'auto'
  }

  playStart() {
    this.startSound.currentTime = 0
    this.startSound.play().catch(console.error)
  }

  playEnding() {
    this.endingSound.currentTime = 0
    this.endingSound.play().catch(console.error)
  }

  playError() {
    this.errorSound.currentTime = 0
    this.errorSound.play().catch(console.error)
  }
}

export const soundManager = new SoundManager() 