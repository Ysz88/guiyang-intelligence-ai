interface SpeechRecognitionEventLike {
  results: ArrayLike<{
    0: { transcript: string; confidence?: number }
  }>
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export function speakPrompt(text: string) {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.88
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function createSpeechRecognizer(
  onResult: (text: string, confidence: number | null) => void,
  onEnd: () => void,
): SpeechRecognitionLike | null {
  const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!Constructor) return null

  const recognition = new Constructor()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.continuous = false
  recognition.onresult = (event) => {
    const result = event.results[0]?.[0]
    if (result) onResult(result.transcript, result.confidence ?? null)
  }
  recognition.onerror = onEnd
  recognition.onend = onEnd
  return recognition
}

export async function startCamera(video: HTMLVideoElement) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前浏览器不支持摄像头访问')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 } },
    audio: false,
  })
  video.srcObject = stream
  await video.play()
  return stream
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}
