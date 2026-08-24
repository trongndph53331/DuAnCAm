export const ALERT_SPEECH_PREFERENCE_EVENT = "antam:alert-speech-preference";
export const ALERT_SPEECH_TEST_EVENT = "antam:alert-speech-test";
const STORAGE_PREFIX = "antam.alertSpeech";

export type AlertSpeechSpeed = "slow" | "normal" | "fast";
export interface AlertSpeechPreferences {
  enabled: boolean;
  volume: number;
  speed: AlertSpeechSpeed;
  activated: boolean;
}
export interface SpeechAlert {
  id?: string;
  event_type?: string;
  camera_location?: string | null;
  camera_id?: string | null;
}
export interface SpeechRealtimeMessage {
  type?: string;
  alert?: SpeechAlert;
}

const DEFAULTS: AlertSpeechPreferences = { enabled: false, volume: 0.8, speed: "normal", activated: false };
const rateBySpeed: Record<AlertSpeechSpeed, number> = { slow: 0.75, normal: 0.9, fast: 1.1 };

export function alertSpeechStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

export function readAlertSpeechPreferences(userId: string): AlertSpeechPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(alertSpeechStorageKey(userId)) ?? "null") as Partial<AlertSpeechPreferences> | null;
    return {
      enabled: value?.enabled === true,
      volume: Math.min(1, Math.max(0, Number(value?.volume ?? DEFAULTS.volume))),
      speed: value?.speed && value.speed in rateBySpeed ? value.speed : DEFAULTS.speed,
      activated: value?.activated === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAlertSpeechPreferences(userId: string, preferences: AlertSpeechPreferences): void {
  try {
    localStorage.setItem(alertSpeechStorageKey(userId), JSON.stringify(preferences));
  } catch {
    // Keep the in-memory preference when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(ALERT_SPEECH_PREFERENCE_EVENT, { detail: { userId, preferences } }));
}

function safeLocation(location?: string | null): string {
  const value = location?.trim();
  return value && !/^(unknown|n\/a|null|undefined)$/i.test(value) ? value : "khu vực đang theo dõi";
}

export function buildAlertSpeechMessage(alert: SpeechAlert): string | null {
  const eventType = alert.event_type?.toUpperCase() ?? "";
  const location = safeLocation(alert.camera_location);
  if (eventType.includes("FALL"))
    return `Cảnh báo khẩn cấp, phát hiện có người có khả năng té ngã tại ${location}. Vui lòng kiểm tra ngay.`;
  if (eventType.includes("UNKNOWN") || eventType.includes("INTRUDER"))
    return `Cảnh báo, phát hiện người lạ tại ${location}.`;
  if (eventType === "CAMERA_OFFLINE")
    return `Thông báo, camera tại ${location} đã mất kết nối.`;
  return null;
}

type QueueItem = { text: string; priority: number };

export function findVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return voices.find((voice) => voice.lang.toLowerCase() === "vi-vn")
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("vi"))
    ?? null;
}

export class AlertSpeechController {
  private readonly processedIds = new Set<string>();
  private readonly recentKinds = new Map<string, number>();
  private queue: QueueItem[] = [];
  private speaking = false;
  private preferences: AlertSpeechPreferences;
  private vietnameseVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  private voiceWaitTimer: number | undefined;
  private readonly refreshVoices = () => {
    const voices = this.synthesis?.getVoices() ?? [];
    if (!voices.length) return;
    this.voicesLoaded = true;
    this.vietnameseVoice = findVietnameseVoice(voices);
    if (this.voiceWaitTimer) window.clearTimeout(this.voiceWaitTimer);
    this.voiceWaitTimer = undefined;
    this.drain();
  };

  constructor(
    preferences: AlertSpeechPreferences,
    private readonly synthesis: SpeechSynthesis | null,
    private readonly createUtterance: (text: string) => SpeechSynthesisUtterance = (text) => new SpeechSynthesisUtterance(text),
    private readonly now: () => number = () => Date.now(),
    private readonly maxQueue = 5,
  ) {
    this.preferences = preferences;
    this.refreshVoices();
    this.synthesis?.addEventListener("voiceschanged", this.refreshVoices);
  }

  get supported(): boolean { return this.synthesis !== null; }
  get pendingCount(): number { return this.queue.length; }

  setPreferences(preferences: AlertSpeechPreferences): void {
    this.preferences = preferences;
    if (!preferences.enabled) this.stop();
  }

  handle(message: SpeechRealtimeMessage, activeSession = true): "ignored" | "muted" | "unsupported" | "queued" {
    const alert = message.alert;
    const id = alert?.id;
    if (message.type !== "alert_created" || !alert || !id || this.processedIds.has(id)) return "ignored";
    this.processedIds.add(id);
    if (!activeSession || !this.preferences.enabled || !this.preferences.activated) return "muted";
    if (!this.synthesis) return "unsupported";
    const text = buildAlertSpeechMessage(alert);
    if (!text) return "ignored";
    const eventType = alert.event_type?.toUpperCase() ?? "";
    const kind = eventType.includes("FALL") ? "fall" : eventType === "CAMERA_OFFLINE" ? "offline" : "stranger";
    const camera = alert.camera_id || alert.camera_location || "unknown";
    const duplicateKey = `${kind}:${camera}`;
    const time = this.now();
    if (time - (this.recentKinds.get(duplicateKey) ?? Number.NEGATIVE_INFINITY) < 10_000) return "ignored";
    this.recentKinds.set(duplicateKey, time);
    const item = { text, priority: kind === "fall" ? 2 : 1 };
    const insertAt = this.queue.findIndex((queued) => queued.priority < item.priority);
    if (insertAt < 0) this.queue.push(item); else this.queue.splice(insertAt, 0, item);
    if (this.queue.length > this.maxQueue) this.queue.pop();
    this.drain();
    return "queued";
  }

  test(): boolean {
    if (!this.synthesis || !this.preferences.enabled || !this.preferences.activated) return false;
    this.queue.unshift({ text: "Cảnh báo bằng giọng nói đã được bật.", priority: 3 });
    this.drain();
    return true;
  }

  stop(): void {
    this.queue = [];
    this.speaking = false;
    if (this.voiceWaitTimer) window.clearTimeout(this.voiceWaitTimer);
    this.voiceWaitTimer = undefined;
    try { this.synthesis?.cancel(); } catch { /* Browser TTS errors are non-fatal. */ }
  }

  destroy(): void {
    this.stop();
    this.synthesis?.removeEventListener("voiceschanged", this.refreshVoices);
  }

  private drain(): void {
    if (this.speaking || !this.queue.length || !this.synthesis) return;
    if (!this.voicesLoaded) {
      this.refreshVoices();
      if (!this.voicesLoaded && !this.voiceWaitTimer) {
        this.voiceWaitTimer = window.setTimeout(() => {
          this.voicesLoaded = true;
          this.voiceWaitTimer = undefined;
          this.drain();
        }, 1_500);
      }
      if (!this.voicesLoaded) return;
    }
    const item = this.queue.shift()!;
    this.enqueueUtterance(item.text);
  }

  private enqueueUtterance(text: string): void {
    if (!this.synthesis) return;
    try {
      const utterance = this.createUtterance(text);
      utterance.lang = "vi-VN";
      utterance.rate = rateBySpeed[this.preferences.speed];
      utterance.pitch = 1;
      utterance.volume = this.preferences.volume;
      if (this.vietnameseVoice) utterance.voice = this.vietnameseVoice;
      this.speaking = true;
      const complete = () => { this.speaking = false; this.drain(); };
      utterance.onend = complete;
      utterance.onerror = complete;
      this.synthesis.speak(utterance);
    } catch (error) {
      this.speaking = false;
      console.warn("Không thể phát cảnh báo bằng giọng nói", error);
      this.drain();
    }
  }
}

export function browserSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window
    ? window.speechSynthesis : null;
}
