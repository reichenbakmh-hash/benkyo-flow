export type AmbientSoundId = "none" | "white-noise" | "rain" | "cafe" | "nature";

export interface AmbientSoundOption {
  id: AmbientSoundId;
  label: string;
}

export const AMBIENT_SOUNDS: AmbientSoundOption[] = [
  { id: "none", label: "Aucun son" },
  { id: "white-noise", label: "Bruit blanc" },
  { id: "rain", label: "Pluie" },
  { id: "cafe", label: "Brouhaha de café" },
  { id: "nature", label: "Vent" },
];

const NOISE_BUFFER_SECONDS = 4;
const MAX_GAIN = 0.5;

export class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private currentSound: AmbientSoundId = "none";

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private teardownGraph() {
    try {
      this.source?.stop();
    } catch {
      /* déjà arrêté */
    }
    this.source?.disconnect();
    this.filter?.disconnect();
    try {
      this.lfo?.stop();
    } catch {
      /* déjà arrêté */
    }
    this.lfo?.disconnect();
    this.lfoGain?.disconnect();
    this.masterGain?.disconnect();
    this.source = null;
    this.filter = null;
    this.lfo = null;
    this.lfoGain = null;
    this.masterGain = null;
  }

  setVolume(volume0to100: number) {
    if (this.masterGain && this.ctx) {
      const target = Math.max(0, Math.min(1, volume0to100 / 100)) * MAX_GAIN;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }

  play(sound: AmbientSoundId, volume0to100: number) {
    if (sound === "none") {
      this.stop();
      return;
    }
    const ctx = this.ensureContext();
    if (this.currentSound === sound && this.source) {
      this.setVolume(volume0to100);
      return;
    }
    this.teardownGraph();
    this.currentSound = sound;

    const buffer = this.buildNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const masterGain = ctx.createGain();
    masterGain.gain.value = Math.max(0, Math.min(1, volume0to100 / 100)) * MAX_GAIN;

    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;

    if (sound === "white-noise") {
      filter.type = "lowpass";
      filter.frequency.value = 9000;
    } else if (sound === "rain") {
      filter.type = "bandpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.7;
      lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 400;
    } else if (sound === "cafe") {
      filter.type = "bandpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.5;
      lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 150;
    } else if (sound === "nature") {
      filter.type = "lowpass";
      filter.frequency.value = 500;
      lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 250;
    }

    if (lfo && lfoGain) {
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
    }

    source.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);
    source.start();

    this.source = source;
    this.filter = filter;
    this.masterGain = masterGain;
    this.lfo = lfo;
    this.lfoGain = lfoGain;
  }

  stop() {
    this.teardownGraph();
    this.currentSound = "none";
  }

  dispose() {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.noiseBuffer = null;
  }
}
