export const ALERT_SOUND_PREFERENCE_EVENT = "antam:alert-sound-preference";
const ALERT_SOUND_STORAGE_PREFIX = "antam.alertSound.enabled";

export interface RealtimeAlertMessage {
  type?: string;
  alert?: { id?: string };
}

export interface AlertSoundPlayer {
  readonly unlocked: boolean;
  unlock(): Promise<boolean>;
  play(): boolean;
  close(): void;
}

export function alertSoundStorageKey(userId: string): string {
  return `${ALERT_SOUND_STORAGE_PREFIX}.${userId}`;
}

export function readAlertSoundEnabled(userId: string, isAdmin: boolean): boolean {
  try {
    const stored = localStorage.getItem(alertSoundStorageKey(userId));
    return stored === null ? isAdmin : stored !== "false";
  } catch {
    return isAdmin;
  }
}

export function saveAlertSoundEnabled(userId: string, enabled: boolean): void {
  try {
    localStorage.setItem(alertSoundStorageKey(userId), String(enabled));
  } catch {
    // The in-memory preference still applies when private storage is blocked.
  }
  window.dispatchEvent(
    new CustomEvent(ALERT_SOUND_PREFERENCE_EVENT, { detail: { userId, enabled } }),
  );
}

export class AlertNotificationController {
  private readonly processedIds = new Set<string>();
  private lastPlayedAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly player: AlertSoundPlayer,
    private enabled: boolean,
    private readonly onNewAlert: (soundBlocked: boolean) => void,
    private readonly now: () => number = () => Date.now(),
    private readonly cooldownMs = 2_000,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  handle(message: RealtimeAlertMessage, activeSession = true): "ignored" | "muted" | "blocked" | "throttled" | "played" {
    const id = message.alert?.id;
    if (message.type !== "alert_created" || !id || this.processedIds.has(id)) return "ignored";
    this.processedIds.add(id);
    if (!activeSession) return "ignored";

    if (!this.enabled) {
      this.onNewAlert(false);
      return "muted";
    }
    if (!this.player.unlocked) {
      this.onNewAlert(true);
      return "blocked";
    }
    const currentTime = this.now();
    if (currentTime - this.lastPlayedAt < this.cooldownMs) {
      this.onNewAlert(false);
      return "throttled";
    }
    if (!this.player.play()) {
      this.onNewAlert(true);
      return "blocked";
    }
    this.lastPlayedAt = currentTime;
    this.onNewAlert(false);
    return "played";
  }
}

export class WebAudioAlertPlayer implements AlertSoundPlayer {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private playing = false;

  get unlocked(): boolean {
    return this.context?.state === "running" && this.buffer !== null;
  }

  async unlock(): Promise<boolean> {
    try {
      if (!this.context) this.context = new AudioContext();
      await this.context.resume();
      if (!this.buffer) {
        const response = await fetch("/sounds/alert-notification.wav", { cache: "force-cache" });
        if (!response.ok) return false;
        this.buffer = await this.context.decodeAudioData(await response.arrayBuffer());
      }
      return this.unlocked;
    } catch {
      return false;
    }
  }

  play(): boolean {
    if (!this.unlocked || !this.context || !this.buffer || this.playing) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.value = 0.6;
    source.buffer = this.buffer;
    source.connect(gain);
    gain.connect(this.context.destination);
    this.playing = true;
    source.onended = () => {
      this.playing = false;
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return true;
  }

  close(): void {
    void this.context?.close();
    this.context = null;
    this.buffer = null;
    this.playing = false;
  }
}
