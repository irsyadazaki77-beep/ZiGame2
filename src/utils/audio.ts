// Web Audio API retro sound generator with volume control, lookahead BGM scheduler & node cleanup
import { logger } from './logger';

class RetroAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 1;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.7;
  private isBgmPlaying: boolean = false;
  private hasUserGesture: boolean = false;
  private pendingBgm: boolean = false;
  private masterGain: GainNode | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private listeners: Set<() => void> = new Set();

  // Lookahead Web Audio API Scheduler fields
  private bgmTimer: any = null;
  private bgmNextNoteTime: number = 0;
  private bgmStep: number = 0;
  private bgmActiveNodes: Set<{ osc: OscillatorNode; gain: GainNode }> = new Set();
  private readonly lookaheadMs: number = 30; // Scheduler tick interval
  private readonly scheduleAheadTime: number = 0.12; // 120ms lookahead horizon

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedMute = localStorage.getItem('zigame_muted');
        if (savedMute !== null) {
          this.isMuted = savedMute === 'true';
        }
        const savedMasterVol = localStorage.getItem('zigame_master_vol');
        if (savedMasterVol !== null) {
          const parsed = parseFloat(savedMasterVol);
          if (!Number.isNaN(parsed)) this.masterVolume = Math.max(0, Math.min(1, parsed));
        }
        const savedMusicVol = localStorage.getItem('zigame_music_vol');
        if (savedMusicVol !== null) {
          const parsed = parseFloat(savedMusicVol);
          if (!Number.isNaN(parsed)) this.musicVolume = Math.max(0, Math.min(1, parsed));
        }
        const savedSfxVol = localStorage.getItem('zigame_sfx_vol');
        if (savedSfxVol !== null) {
          const parsed = parseFloat(savedSfxVol);
          if (!Number.isNaN(parsed)) this.sfxVolume = Math.max(0, Math.min(1, parsed));
        }
      } catch {
        // Quietly ignore storage access restrictions
      }
    }
    this.setupMobileAutoUnlock();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // Ignore subscriber errors
      }
    });
  }

  private applyMasterGain(): void {
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  public unlockAudio() {
    this.hasUserGesture = true;
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      try {
        // Play an instantaneous silent buffer to prime iOS WebKit audio engine
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
      } catch {}
    }
    if (this.pendingBgm && !this.isMuted && !this.isBgmPlaying && this.musicVolume > 0 && this.masterVolume > 0) {
      this.pendingBgm = false;
      this.startBGM();
    }
  }

  public setupMobileAutoUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.unlockAudio();
      const events = ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'keydown'];
      events.forEach((evt) => {
        window.removeEventListener(evt, unlock, true);
        document.removeEventListener(evt, unlock, true);
      });
    };
    const events = ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'keydown'];
    events.forEach((evt) => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
      document.addEventListener(evt, unlock, { capture: true, passive: true });
    });
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.ctx && this.ctx.state === 'running') {
              this.ctx.suspend().catch(() => {});
            } else if (!document.hidden && this.hasUserGesture && this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
              this.ctx.resume().catch(() => {});
            }
          });
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.hasUserGesture) {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Tracks audio nodes and automatically disconnects and unregisters them on the 'onended' event
   * to guarantee zero memory leaks over extended play sessions.
   */
  private trackNode(sourceNode: AudioScheduledSourceNode, ...connectedNodes: AudioNode[]): void {
    this.activeNodes.add(sourceNode);
    connectedNodes.forEach((node) => this.activeNodes.add(node));

    const existingOnEnded = sourceNode.onended;
    sourceNode.onended = (ev: Event) => {
      if (typeof existingOnEnded === 'function') {
        try {
          existingOnEnded.call(sourceNode, ev);
        } catch {}
      }
      try {
        sourceNode.disconnect();
        this.activeNodes.delete(sourceNode);
      } catch {}

      connectedNodes.forEach((node) => {
        try {
          node.disconnect();
          this.activeNodes.delete(node);
        } catch {}
      });
    };
  }

  public registerNode(node: AudioNode, stopTime?: number) {
    this.activeNodes.add(node);
    if ('onended' in node) {
      const scheduledSource = node as unknown as AudioScheduledSourceNode;
      const prevEnded = scheduledSource.onended;
      scheduledSource.onended = (e: Event) => {
        if (typeof prevEnded === 'function') {
          try {
            prevEnded.call(scheduledSource, e);
          } catch {}
        }
        try {
          node.disconnect();
          this.activeNodes.delete(node);
        } catch {}
      };
    } else if (stopTime !== undefined) {
      setTimeout(() => {
        try {
          node.disconnect();
          this.activeNodes.delete(node);
        } catch {}
      }, (stopTime + 0.05) * 1000);
    }
  }

  public getActiveNodeCount(): number {
    return this.activeNodes.size;
  }

  public stopAllSounds() {
    this.stopBGM();
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          (node as any).stop();
        }
        node.disconnect();
      } catch {}
    });
    this.activeNodes.clear();
  }

  setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    try {
      localStorage.setItem('zigame_muted', String(this.isMuted));
    } catch {}
    if (this.isMuted) {
      this.stopBGM();
    }
    this.applyMasterGain();
    this.notify();
    return this.isMuted;
  }

  toggleMute(): boolean {
    return this.setMuted(!this.isMuted);
  }

  getMuteState(): boolean {
    return this.isMuted;
  }

  setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('zigame_master_vol', String(this.masterVolume));
    } catch {}
    this.applyMasterGain();
    if (this.masterVolume <= 0) {
      this.stopBGM();
    }
    this.notify();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('zigame_music_vol', String(this.musicVolume));
    } catch {}
    if (this.musicVolume <= 0) {
      this.stopBGM();
    }
    this.notify();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('zigame_sfx_vol', String(this.sfxVolume));
    } catch {}
    this.notify();
  }

  getSfxVolume(): number {
    return this.sfxVolume;
  }

  playClick() {
    if (this.isMuted || this.sfxVolume <= 0 || this.masterVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.045);

      gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {}
  }

  playEat() {
    this.playCoin();
  }

  playCoin() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);

      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  playJump() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

      gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  playLaser() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  playScore() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const noteTime = now + index * 0.08;
        gain.gain.setValueAtTime(0.15 * this.sfxVolume, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);

        this.trackNode(osc, gain);
        osc.start(noteTime);
        osc.stop(noteTime + 0.15);
      });
    } catch {}
  }

  playCombo(combo: number = 1) {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 392; // G4
      const pitchFactor = Math.pow(1.08, Math.min(15, combo));
      const freq = baseFreq * pitchFactor;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.12);

      gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  playNearMiss() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.08);

      gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  playReflect() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.09);

      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  playShield() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(900, now + 0.25);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  playHitStop() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);

      gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  playCountdownTick() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5

      gain.gain.setValueAtTime(0.1 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  playCountdown(step?: number) {
    if (step === 0) {
      this.playCountdownGo();
    } else {
      this.playCountdownTick();
    }
  }

  playCountdownGo() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.50, now); // C6

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  playLevelUp() {
    this.playWin();
  }

  playWin() {
    if (this.isMuted || this.sfxVolume <= 0 || this.masterVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.085;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.14 * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackNode(osc, gain);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch {}
  }

  playGameOver() {
    if (this.isMuted || this.sfxVolume <= 0 || this.masterVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [392.0, 329.63, 261.63, 196.0];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.11;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.14);
        gain.gain.setValueAtTime(0.11 * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        this.trackNode(osc, gain);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch {}
  }

  playError() {
    this.playHit();
  }

  playCrash() {
    this.playExplosion();
  }

  playMove() {
    this.playClick();
  }

  playHit() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

      gain.gain.setValueAtTime(0.2 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  playPowerup() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.3);

      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(osc, gain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  playPowerUp() {
    this.playPowerup();
  }

  playExplosion() {
    if (this.isMuted || this.sfxVolume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(50, now + 0.3);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      this.trackNode(whiteNoise, filter, gain);
      whiteNoise.start(now);
      whiteNoise.stop(now + 0.3);
    } catch {}
  }

  /**
   * Lookahead Web Audio API Scheduler:
   * Uses this.ctx.currentTime to schedule musical notes ahead in time.
   * Completely immune to timer drift, background tab throttling, or frame rate drops.
   */
  private scheduleBGM(): void {
    if (!this.isBgmPlaying || !this.ctx || this.isMuted || this.musicVolume <= 0) return;

    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];
    const noteDuration = 0.25; // 250ms per step

    // Schedule any notes that fall within the lookahead window
    while (this.bgmNextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      const startTime = this.bgmNextNoteTime;
      const stopTime = startTime + 0.2;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const noteIndex = (this.bgmStep % 4) * 2;
        const freq = notes[noteIndex % notes.length];

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.03 * this.musicVolume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

        osc.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);

        const nodeItem = { osc, gain };
        this.bgmActiveNodes.add(nodeItem);
        this.activeNodes.add(osc);
        this.activeNodes.add(gain);

        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {}
          this.activeNodes.delete(osc);
          this.activeNodes.delete(gain);
          this.bgmActiveNodes.delete(nodeItem);
        };

        osc.start(startTime);
        osc.stop(stopTime);
      } catch {}

      this.bgmNextNoteTime += noteDuration;
      this.bgmStep++;
    }
  }

  startBGM() {
    if (this.isMuted || this.isBgmPlaying || this.musicVolume <= 0 || this.masterVolume <= 0) return;
    if (!this.hasUserGesture) {
      this.pendingBgm = true;
      return;
    }
    this.initContext();
    if (!this.ctx) return;

    this.pendingBgm = false;
    this.isBgmPlaying = true;
    this.bgmStep = 0;
    // Anchor next note time to current audio hardware clock + small initial buffer
    this.bgmNextNoteTime = this.ctx.currentTime + 0.02;

    // Run lookahead scheduler immediately, then repeatedly via short interval timer
    this.scheduleBGM();

    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
    }
    this.bgmTimer = setInterval(() => {
      this.scheduleBGM();
    }, this.lookaheadMs);
  }

  startBgm() {
    this.startBGM();
  }

  stopBGM() {
    this.pendingBgm = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.isBgmPlaying = false;
    this.bgmStep = 0;

    // Stop and immediately disconnect all currently running or scheduled BGM nodes
    this.bgmActiveNodes.forEach(({ osc, gain }) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
      try {
        gain.disconnect();
      } catch {}
      this.activeNodes.delete(osc);
      this.activeNodes.delete(gain);
    });
    this.bgmActiveNodes.clear();
  }

  stopBgm() {
    this.stopBGM();
  }

  getBGMState(): boolean {
    return this.isBgmPlaying;
  }
}

export const audio = new RetroAudio();
