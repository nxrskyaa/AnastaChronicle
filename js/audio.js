// Procedural audio: Web Audio synth. No asset files. Music loops + SFX.
class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVol = 0.35;
    this.sfxVol = 0.5;
    this.musicOn = true;
    this.sfxOn = true;
    this._musicTimer = null;
    this._track = null;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }
  setMusicVol(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = this.musicOn ? v : 0; }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  toggleMusic(on) { this.musicOn = on; if (this.musicGain) this.musicGain.gain.value = on ? this.musicVol : 0; }

  // ---- SFX ----
  blip(freq, dur, type = "square", vol = 0.5, slideTo = null) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.4, hp = 800) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t);
  }
  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case "attack": this.blip(320, 0.09, "square", 0.28, 180); this.noise(0.06, 0.18, 1200); break;
      case "hit": this.noise(0.09, 0.3, 500); this.blip(140, 0.08, "square", 0.22, 80); break;
      case "crit": this.noise(0.12, 0.35, 400); this.blip(220, 0.14, "sawtooth", 0.3, 90); break;
      case "hurt": this.blip(200, 0.18, "sawtooth", 0.3, 70); break;
      case "level": [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, "square", 0.32), i * 90)); break;
      case "chest": [659, 880, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, "triangle", 0.3), i * 70)); break;
      case "pet": [784, 988, 1319].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, "triangle", 0.3), i * 80)); break;
      case "quest": [659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.13, "square", 0.3), i * 90)); break;
      case "ui": this.blip(880, 0.05, "square", 0.18); break;
      case "heal": [523, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, "sine", 0.28), i * 90)); break;
      case "whirl": this.noise(0.25, 0.3, 300); this.blip(180, 0.25, "sawtooth", 0.22, 400); break;
      case "dash": this.noise(0.12, 0.22, 900); break;
      case "step": this.noise(0.03, 0.06, 1500); break;
      case "coin": this.blip(988, 0.06, "square", 0.2, 1319); break;
    }
  }

  // ---- procedural music: simple looped chord + arpeggio ----
  startMusic(mood = "explore") {
    if (!this.ctx || this._track === mood) return;
    this.stopMusic();
    this._track = mood;
    const scales = {
      explore: [220, 246.94, 293.66, 329.63, 392, 440],   // A minor pentatonic-ish, calm
      title:   [261.63, 329.63, 392, 523.25, 659.25],     // C major bright
    };
    const scale = scales[mood] || scales.explore;
    let step = 0;
    const bpm = mood === "title" ? 96 : 76;
    const beat = 60 / bpm;
    const bass = [110, 110, 146.83, 130.81];
    this._musicTimer = setInterval(() => {
      if (!this.musicOn) return;
      const t = this.ctx.currentTime;
      // bass note every 2 steps
      if (step % 2 === 0) {
        const bf = bass[(step / 2) % bass.length];
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = "triangle"; o.frequency.value = bf;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + beat * 1.6);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + beat * 1.8);
      }
      // melody note
      const mf = scale[(step * 3 + (step % 5)) % scale.length] * (step % 8 < 4 ? 1 : 2);
      const o2 = this.ctx.createOscillator(); const g2 = this.ctx.createGain();
      o2.type = "square"; o2.frequency.value = mf;
      g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.14, t + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, t + beat * 0.9);
      o2.connect(g2); g2.connect(this.musicGain); o2.start(t); o2.stop(t + beat);
      step = (step + 1) % 64;
    }, beat * 1000);
  }
  stopMusic() { if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; } this._track = null; }
}

export const audio = new Audio();
