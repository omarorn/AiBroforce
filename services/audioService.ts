
class AudioService {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private musicSource: AudioBufferSourceNode | null = null;
  private isMuted = false;
  private gainNode: GainNode | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private areVoicesLoaded = false;

  // SFX generated from https://sfxr.me/
  private soundData: { [key: string]: string } = {
    shoot_rifle: 'data:audio/wav;base64,UklGRjwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRIAAAAA//8CAP/A/7z/sf+5/8D/zv/Z/9//AAMA////AP/3/7b/q//L/8//wv/M/8z/yv/E/7v/p//F/7v/mv+s/6b/pP+k/57/oP+f/5v/l/+R/4//iv+M/4s=',
    shoot_shotgun: 'data:audio/wav;base64,UklGRkAAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABgAZGF0YVgAAAAA6d/7/AcDCw8TFhkbHR8hIiMmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSj5CRj48=',
    shoot_grenade: 'data:audio/wav;base64,UklGRkAAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVgAAAAQAAAEBwkODxESExQVFhcYGRobHB0eHx8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY4=',
    explosion: 'data:audio/wav;base64,UklGRlAAAABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABgAZGF0YVgAAAAA09LS0tTU09PT0dHRzs7OysrJycnHx8fDw8O/v7+/v76+vr29vby8vLy8vLy7u7u7u7u6urq6urq6urq5ubm5ubm4uLi4uLi4uLi3t7e3t7e2tra2tra2trW1tQ==',
    hurt: 'data:audio/wav;base64,UklGRkIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUgAAAAAAACR/7v/mv+f/6v/x//l/wL/FP8u/zz/S/9j/2v/cv96/3//gv+L/5L/n/+n/6//u/+8/7z/uv+1/6//qP+m/6T/ov+g/5//mv+X/5P/k/+Q/47/jf+M/4r/if+G/4T/gv9//3v/df9x/2v/Z/9d/1f/U/9Q/03/S/9J/0f/RP9C/z//O/83/zL/L/8s/ys=',
    jump: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAA/v/9/9L/xv/C/8n/y//S/9n/3f/i/+f/6v/w//P/9v/6//3//v/8/9T/wP+w/5j/j/+D/3z/bf9d/1r/W/9c/1//Yf9l/2r/c/96/4D/h/+M/5E=',
    rescue: 'data:audio/wav;base64,UklGRkIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUgAAAAAAACt/5r/lf+R/5L/lf+b/6H/qP+x/7r/wv/J/8//1//b/97/3v/d/9j/0f/N/8j/xP/C/8H/v/+5/7P/qv+l/6D/mv+U/47/if9//2v/Uf9F/zv/Lv8o/yc/KSctLzM4O0BETFFSXGBlaW9zdHp/hIyQlp+lrsPL1Njq/w==',
    dash: 'data:audio/wav;base64,UklGRiIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRgAAAAA////gP9z/1L/QP8s/yH/Hf8n/zD/R/9g/3L/ff+E/4r/kv+b/5//q/+z/7r/w//G/8r/y//L/8r/x//D/7//t/+p/5z/lf+L/3//b/9R/zz/Lf8h/x7/IQ==',
    music_menu: 'data:audio/wav;base64,UklGRqYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIAAABJ/zX/N/85/zv/PP9B/0X/SP9M/1L/VP9b/2H/af9w/3X/f/94/2f/Vf8+LzMxMzU4Ojs+P0FCQ0RFRkhJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==',
    music_game: 'data:audio/wav;base64,UklGRlIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUYAAAAASf81/zf/Of87/zz/Qf9F/0j/TP9S/1T/W/9h/2n/cP91/3//ef9n/1X/PjwwMTI0Njc5Ojs+P0FCQ0RFRkhJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2enw==',
  };

  constructor() {
    // Defer initialization until first user interaction to comply with browser audio policies.
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
    }
    
    const setVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        if (this.voices.length > 0) {
            this.areVoicesLoaded = true;
            // No need to listen anymore if we have voices
            if (window.speechSynthesis) {
              window.speechSynthesis.onvoiceschanged = null;
            }
        }
    };

    setVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = setVoices;
    }
  }

  private async init() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      if (this.isMuted) {
        this.gainNode.gain.value = 0;
      }
      this.loadVoices(); // Init TTS
      await this._loadAllSounds();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser or initialization failed.", e);
    }
  }

  private async _loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) return;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.sounds.set(name, audioBuffer);
    } catch(e) {
        console.error(`Failed to load sound: ${name}`, e);
    }
  }

  private async _loadAllSounds() {
    const soundPromises: Promise<void>[] = [];
    for (const key in this.soundData) {
        soundPromises.push(this._loadSound(key, this.soundData[key]));
    }
    await Promise.all(soundPromises);
  }

  public async playSound(name: string): Promise<void> {
    await this.init(); // Ensure context is ready
    if (!this.audioContext || !this.gainNode || !this.sounds.has(name)) {
        return;
    };

    const source = this.audioContext.createBufferSource();
    source.buffer = this.sounds.get(name)!;
    source.connect(this.gainNode);
    source.start(0);
  }

  public async playMusic(name: string): Promise<void> {
    await this.init();
    if (!this.audioContext || !this.gainNode || !this.sounds.has(name)) {
        return;
    }

    this.stopMusic();
    
    this.musicSource = this.audioContext.createBufferSource();
    this.musicSource.buffer = this.sounds.get(name)!;
    this.musicSource.loop = true;
    this.musicSource.connect(this.gainNode);
    this.musicSource.start(0);
  }

  public stopMusic(): void {
    if (this.musicSource) {
      this.musicSource.stop(0);
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }
  
  public async speak(text: string): Promise<void> {
    await this.init(); // Ensure AudioContext is ready (and by extension, the voice attempt has been made)
    if (!('speechSynthesis' in window) || !this.audioContext || !text.trim()) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Voice selection logic
    if (this.areVoicesLoaded) {
        const preferredVoices = [
            'Google US English', 'Daniel', 'Samantha', 
            'Microsoft David - English (United States)', 
            'Microsoft Zira - English (United States)'
        ];
        let selectedVoice = this.voices.find(voice => preferredVoices.includes(voice.name));
        if (!selectedVoice) {
            selectedVoice = this.voices.find(voice => voice.lang === 'en-US' && voice.name.includes('Google')) ||
                           this.voices.find(voice => voice.lang === 'en-US') ||
                           this.voices.find(voice => voice.lang === 'en-GB');
        }
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
    }
    
    utterance.pitch = 0.8;
    utterance.rate = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  public toggleMute(): boolean {
    // Call init here to ensure AudioContext is created on first mute toggle if no sound has been played yet.
    if (!this.audioContext) {
        this.init();
    }
    
    this.isMuted = !this.isMuted;
    
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : 1, this.audioContext.currentTime);
    }
    return this.isMuted;
  }
}

export const audioService = new AudioService();