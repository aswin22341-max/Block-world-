class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  public volume = 0.65;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainScale = 0.25,
  ) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);

    const peak = Math.max(0.001, this.volume * gainScale);
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playClick() {
    this.playTone(620, 420, 0.06, 'triangle', 0.14);
  }

  playJump() {
    this.playTone(220, 520, 0.14, 'triangle', 0.22);
  }

  playCoin() {
    this.playTone(880, 1320, 0.08, 'sine', 0.22);
    setTimeout(() => this.playTone(1320, 1760, 0.12, 'sine', 0.2), 65);
  }

  playPlace() {
    this.playTone(300, 190, 0.08, 'square', 0.15);
  }

  playBreak() {
    this.playTone(180, 75, 0.12, 'sawtooth', 0.16);
  }

  playCheckpoint() {
    this.playTone(523, 659, 0.1, 'triangle', 0.2);
    setTimeout(() => this.playTone(659, 784, 0.12, 'triangle', 0.2), 90);
    setTimeout(() => this.playTone(784, 1046, 0.18, 'triangle', 0.22), 180);
  }

  playWin() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.03, 0.18, 'triangle', 0.24), idx * 95);
    });
  }

  playTag() {
    this.playTone(740, 260, 0.12, 'sawtooth', 0.2);
  }

  playPet() {
    this.playTone(680, 960, 0.08, 'sine', 0.18);
    setTimeout(() => this.playTone(820, 1120, 0.09, 'sine', 0.16), 80);
  }
}

export const soundEngine = new SoundEngine();
