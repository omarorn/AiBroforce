
class AudioService {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted = false;
  private voices: SpeechSynthesisVoice[] = [];
  private areVoicesLoaded = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // Defer initialization
  }

  // --- Web Audio Initialization ---

  private async init() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.isMuted ? 0 : 0.4; // Default volume 40%
      
      this.createNoiseBuffer();
      this.loadVoices();
    } catch (e) {
      console.error("Web Audio API init failed", e);
    }
  }

  private createNoiseBuffer() {
      if (!this.audioContext) return;
      const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds of noise
      const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const setVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        if (this.voices.length > 0) this.areVoicesLoaded = true;
    };
    setVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = setVoices;
    }
  }

  // --- Procedural Sound Generators (8-bit style) ---

  // Generic Tone Generator
  private playTone(freq: number, type: OscillatorType, duration: number, startTime: number = 0, slideFreq: number | null = null) {
      if (!this.audioContext || !this.masterGain) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioContext.currentTime + startTime);
      if (slideFreq) {
          osc.frequency.exponentialRampToValueAtTime(slideFreq, this.audioContext.currentTime + startTime + duration);
      }

      gain.gain.setValueAtTime(0.3, this.audioContext.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(this.audioContext.currentTime + startTime);
      osc.stop(this.audioContext.currentTime + startTime + duration);
  }

  // Noise Generator (Explosions, Gunshots)
  private playNoise(duration: number, filterType: BiquadFilterType = 'lowpass', filterFreq: number = 1000) {
      if (!this.audioContext || !this.masterGain || !this.noiseBuffer) return;
      const src = this.audioContext.createBufferSource();
      const filter = this.audioContext.createBiquadFilter();
      const gain = this.audioContext.createGain();

      src.buffer = this.noiseBuffer;
      src.loop = true;

      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, this.audioContext.currentTime);
      if (filterType === 'lowpass') {
          filter.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + duration);
      }

      gain.gain.setValueAtTime(0.5, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      src.start();
      src.stop(this.audioContext.currentTime + duration);
  }

  // --- Public API mapped to procedural sounds ---

  public async playSound(name: string): Promise<void> {
    await this.init();
    if (!this.audioContext) return;

    switch (name) {
        case 'shoot_rifle':
            // High pass noise, short
            this.playNoise(0.1, 'highpass', 1000);
            this.playTone(150, 'square', 0.1, 0, 50);
            break;
        case 'shoot_shotgun':
            // Low pass noise, punchy
            this.playNoise(0.3, 'lowpass', 800);
            this.playTone(100, 'sawtooth', 0.15, 0, 30);
            break;
        case 'shoot_grenade':
            // Thump
            this.playTone(200, 'triangle', 0.2, 0, 50);
            this.playNoise(0.2, 'lowpass', 500);
            break;
        case 'explosion':
            // Long noise decay
            this.playNoise(0.6, 'lowpass', 600);
            // Screen shake rumble
            this.playTone(60, 'sawtooth', 0.4, 0, 10);
            break;
        case 'jump':
            // Rising square wave (Mario style)
            this.playTone(150, 'square', 0.15, 0, 350);
            break;
        case 'dash':
             // White noise whoosh
             this.playNoise(0.2, 'bandpass', 2000);
             break;
        case 'hurt':
            // Descending tone
            this.playTone(300, 'sawtooth', 0.2, 0, 50);
            break;
        case 'rescue':
        case 'powerup':
            // Arpeggio
            this.playTone(440, 'sine', 0.1, 0); // A4
            this.playTone(554, 'sine', 0.1, 0.1); // C#5
            this.playTone(659, 'sine', 0.2, 0.2); // E5
            break;
    }
  }

  public async playMusic(name: string): Promise<void> {
    // Placeholder: Procedural music is complex. 
    // For now, we'll just play a low drone ambiance to fit the theme.
    await this.init();
    if (name === 'music_menu') {
        // Just a clean silence for menu or light hum? Let's skip persistent drone to avoid annoyance.
    }
  }

  public stopMusic(): void {
      // No-op for now as we removed the loops
  }

  public async speak(text: string): Promise<void> {
    await this.init();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Clean text for speech
    const cleanText = text.replace(/["*]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (this.areVoicesLoaded) {
        // Try to find a "tough" voice (Google US English is usually deep)
        const voice = this.voices.find(v => v.name.includes('Google US English')) || this.voices[0];
        utterance.voice = voice;
    }

    utterance.pitch = 0.6; // Deep voice
    utterance.rate = 1.1; // Fast
    utterance.volume = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }

  public toggleMute(): boolean {
    if (!this.audioContext) this.init();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.audioContext.currentTime);
    }
    return this.isMuted;
  }
}

export const audioService = new AudioService();
