import type { MeasureData, BeatEvent } from '../types/song';
import { getBeatPattern, getSubBeatDuration } from '../utils/songParser';
import aWav from './a.wav';
import bWav from './b.wav';

/**
 * High-precision metronome audio engine using Web Audio API.
 * Implements Chris Wilson's look-ahead scheduling pattern for
 * sample-accurate timing that doesn't drift even under heavy load
 * or when the browser tab is in the background.
 *
 * UI synchronization uses requestAnimationFrame polling of
 * audioContext.currentTime for frame-accurate visual updates.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private schedulerTimer: number | null = null;
  private rafHandle: number | null = null;
  private isPlaying = false;

  // Scheduling parameters
  private readonly LOOKAHEAD = 0.1;          // seconds to look ahead
  private readonly SCHEDULE_INTERVAL = 25;   // ms between scheduler calls

  // Sound parameters
  private readonly ACCENT_FREQ = 880;    // Hz — high pitch accent (A)
  private readonly SUB_FREQ = 440;       // Hz — lower pitch sub-beat (B)
  private readonly ACCENT_DURATION = 0.05; // seconds
  private readonly SUB_DURATION = 0.03;    // seconds
  private readonly ACCENT_GAIN = 0.8;
  private readonly SUB_GAIN = 0.4;

  // Custom 電子音2 buffers
  private bufferA: AudioBuffer | null = null;
  private bufferB: AudioBuffer | null = null;
  private isWavLoaded = false;
  private soundMode: 'synth' | 'wav' = 'synth';

  // Playback state
  private currentMeasureIndex = 0;
  private currentBeatIndex = 0;
  private nextNoteTime = 0;
  private bpm = 120;
  private bpmMode: 'fixed' | 'multiplier' = 'multiplier';
  private multiplier = 1.0;
  private subdivisionMode: '8' | '16' = '8';
  private subStep = 0;

  // Count-in state
  private countInEnabled = true;
  private isCountIn = false;
  private countInBeatsRemaining = 0;
  private countInBeatNumber = 0;       // raw 1-based pattern beat counter
  private countInPattern: ('A' | 'B')[] = [];
  private countInBeatIndex = 0;
  private countInSubStep = 0;
  private countInDisplayInterval = 1;  // 1 for x/8, 2 for x/4 (quarter-note grouping)

  // Song data
  private measures: MeasureData[] = [];
  private currentPattern: ('A' | 'B')[] = [];

  // Callbacks
  private onBeat: ((event: BeatEvent) => void) | null = null;
  private onMeasureChange: ((measureIndex: number) => void) | null = null;
  private onCountInBeat: ((beatNumber: number, totalBeats: number) => void) | null = null;
  private onCountInEnd: (() => void) | null = null;

  // Pending UI events queue — events are scheduled ahead of time and
  // dispatched when audioContext.currentTime reaches their time.
  private pendingBeats: { time: number; event: BeatEvent }[] = [];
  private pendingMeasureChanges: { time: number; measureIndex: number }[] = [];
  private pendingCountInBeats: { time: number; beatNumber: number; totalBeats: number }[] = [];
  private pendingCountInEnd: { time: number }[] = [];

  // Latency compensation (in seconds) to align visual flash with audio arrival.
  // The visual pipeline has multiple delay stages:
  //   1. rAF polling:       ~8-16ms (depends on monitor refresh rate)
  //   2. React re-render:   ~5-10ms (setState batching + virtual DOM diff)
  //   3. Browser paint:     ~1-4ms  (composite + paint)
  // Total: ~15-30ms. We dispatch UI events this far ahead of actual audio time
  // so the visual flash appears synchronised with the sound.
  private readonly UI_LATENCY_COMPENSATION = 0.040; // 40ms early

  /**
   * Initialize the AudioContext. Must be called from a user gesture on iOS.
   */
  async init(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (!this.isWavLoaded) {
      this.isWavLoaded = true;
      await this.loadWavBuffers();
    }
  }

  /**
   * Preload custom 電子音2 files.
   */
  private async loadWavBuffers(): Promise<void> {
    if (!this.audioContext) return;
    try {
      const [resA, resB] = await Promise.all([
        fetch(aWav),
        fetch(bWav)
      ]);
      const [arrayBufferA, arrayBufferB] = await Promise.all([
        resA.arrayBuffer(),
        resB.arrayBuffer()
      ]);
      this.bufferA = await this.audioContext.decodeAudioData(arrayBufferA);
      this.bufferB = await this.audioContext.decodeAudioData(arrayBufferB);
    } catch (err) {
      console.error('Failed to load 電子音2 audio files:', err);
      this.isWavLoaded = false;
    }
  }

  setSoundMode(mode: 'synth' | 'wav'): void {
    this.soundMode = mode;
  }

  getSoundMode(): 'synth' | 'wav' {
    return this.soundMode;
  }

  setCountInEnabled(enabled: boolean): void {
    this.countInEnabled = enabled;
  }

  getCountInEnabled(): boolean {
    return this.countInEnabled;
  }

  /**
   * Set the song data (array of measures).
   */
  setMeasures(measures: MeasureData[]): void {
    this.measures = measures;
    this.updateCurrentPattern();
    if (this.bpmMode === 'multiplier' && this.measures.length > 0) {
      const idx = Math.min(this.currentMeasureIndex, this.measures.length - 1);
      const currentMeasure = this.measures[idx];
      this.bpm = Math.max(20, Math.min(400, Math.round(currentMeasure.target_bpm * this.multiplier)));
    }
  }

  /**
   * Set the BPM (quarter-note basis).
   */
  setBpm(bpm: number): void {
    this.bpm = Math.max(20, Math.min(400, bpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  setBpmMode(mode: 'fixed' | 'multiplier'): void {
    this.bpmMode = mode;
  }

  getBpmMode(): 'fixed' | 'multiplier' {
    return this.bpmMode;
  }

  setMultiplier(multiplier: number): void {
    this.multiplier = multiplier;
  }

  getMultiplier(): number {
    return this.multiplier;
  }

  setSubdivisionMode(mode: '8' | '16'): void {
    this.subdivisionMode = mode;
  }

  getSubdivisionMode(): '8' | '16' {
    return this.subdivisionMode;
  }

  /**
   * Set beat callback — called each time a beat is scheduled.
   */
  setOnBeat(callback: (event: BeatEvent) => void): void {
    this.onBeat = callback;
  }

  /**
   * Set measure change callback.
   */
  setOnMeasureChange(callback: (measureIndex: number) => void): void {
    this.onMeasureChange = callback;
  }

  /**
   * Set count-in beat callback — called each time a count-in beat fires.
   */
  setOnCountInBeat(callback: (beatNumber: number, totalBeats: number) => void): void {
    this.onCountInBeat = callback;
  }

  /**
   * Set count-in end callback — called when count-in finishes.
   */
  setOnCountInEnd(callback: () => void): void {
    this.onCountInEnd = callback;
  }

  /**
   * Check if currently in count-in phase.
   */
  getIsCountIn(): boolean {
    return this.isCountIn;
  }

  /**
   * Jump to a specific measure and beat.
   */
  jumpTo(measureIndex: number, beatIndex = 0): void {
    if (measureIndex < 0 || measureIndex >= this.measures.length) return;
    this.currentMeasureIndex = measureIndex;
    this.currentBeatIndex = beatIndex;
    this.updateCurrentPattern();
    this.subStep = 0;

    if (this.bpmMode === 'multiplier') {
      const currentMeasure = this.measures[this.currentMeasureIndex];
      this.bpm = Math.max(20, Math.min(400, Math.round(currentMeasure.target_bpm * this.multiplier)));
    }

    // Clear pending UI events on jump
    this.pendingBeats = [];
    this.pendingMeasureChanges = [];

    if (this.isPlaying && this.audioContext) {
      // Reset the next note time to now
      this.nextNoteTime = this.audioContext.currentTime;
      // Schedule the jump beat immediately
      this.scheduler();
    }
  }

  /**
   * Get current playback position.
   */
  getPosition(): { measureIndex: number; beatIndex: number } {
    return {
      measureIndex: this.currentMeasureIndex,
      beatIndex: this.currentBeatIndex,
    };
  }

  /**
   * Start playing the metronome.
   */
  async start(): Promise<void> {
    if (this.isPlaying) return;
    if (!this.audioContext) await this.init();
    if (!this.audioContext) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isPlaying = true;
    this.nextNoteTime = this.audioContext.currentTime;
    this.updateCurrentPattern();
    this.pendingBeats = [];
    this.pendingMeasureChanges = [];
    this.pendingCountInBeats = [];
    this.pendingCountInEnd = [];
    this.subStep = 0;

    // Set up count-in: play 1 measure of the opening pattern
    if (this.countInEnabled && this.measures.length > 0) {
      const openingMeasure = this.measures[this.currentMeasureIndex];
      this.countInPattern = getBeatPattern(openingMeasure);
      const beatsPerMeasure = this.countInPattern.length;
      this.countInBeatsRemaining = beatsPerMeasure; // 1 measure of count-in
      this.countInBeatNumber = 0;
      this.countInBeatIndex = 0;
      this.countInSubStep = 0;
      // For x/4 time, display count per quarter note (every 2 eighth notes)
      this.countInDisplayInterval = openingMeasure.denominator === 4 ? 2 : 1;
      this.isCountIn = true;
    } else {
      this.isCountIn = false;
    }

    // Schedule the first notes immediately
    this.scheduler();

    // Start the scheduler loop (schedules audio ahead of time)
    this.schedulerTimer = window.setInterval(() => {
      this.scheduler();
    }, this.SCHEDULE_INTERVAL);

    // Start the rAF loop (dispatches UI events in sync with audio time)
    this.startUiLoop();
  }

  /**
   * Stop playing the metronome.
   */
  stop(): void {
    this.isPlaying = false;
    this.isCountIn = false;
    this.countInBeatsRemaining = 0;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.pendingBeats = [];
    this.pendingMeasureChanges = [];
    this.pendingCountInBeats = [];
    this.pendingCountInEnd = [];
  }

  /**
   * Check if currently playing.
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Dispose resources.
   */
  async dispose(): Promise<void> {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  // ─── Private Methods ─────────────────────────────────────────────

  /**
   * The core scheduler. Runs every SCHEDULE_INTERVAL ms.
   * Looks ahead and schedules all notes within the lookahead window.
   */
  private scheduler(): void {
    if (!this.audioContext || !this.isPlaying) return;

    const deadline = this.audioContext.currentTime + this.LOOKAHEAD;

    while (this.nextNoteTime < deadline) {
      if (this.isCountIn) {
        this.scheduleCountInNote(this.nextNoteTime);
        this.advanceCountIn();
      } else {
        this.scheduleNote(this.nextNoteTime);
        this.advanceNote();
      }
    }
  }

  /**
   * requestAnimationFrame loop that dispatches pending UI events
   * when audioContext.currentTime has reached their scheduled time.
   * This gives frame-accurate visual sync (~16ms at 60Hz, ~8ms at 120Hz)
   * which is much better than setTimeout's ±4-16ms jitter.
   */
  private startUiLoop(): void {
    const tick = () => {
      if (!this.isPlaying || !this.audioContext) return;

      const now = this.audioContext.currentTime;

      // Dispatch pending count-in beat events
      while (this.pendingCountInBeats.length > 0 && this.pendingCountInBeats[0].time <= now + this.UI_LATENCY_COMPENSATION) {
        const entry = this.pendingCountInBeats.shift()!;
        if (this.onCountInBeat) this.onCountInBeat(entry.beatNumber, entry.totalBeats);
      }

      // Dispatch pending count-in end events
      while (this.pendingCountInEnd.length > 0 && this.pendingCountInEnd[0].time <= now + this.UI_LATENCY_COMPENSATION) {
        this.pendingCountInEnd.shift();
        if (this.onCountInEnd) this.onCountInEnd();
      }

      // Dispatch pending beat events whose time has arrived (compensated)
      while (this.pendingBeats.length > 0 && this.pendingBeats[0].time <= now + this.UI_LATENCY_COMPENSATION) {
        const entry = this.pendingBeats.shift()!;
        if (this.onBeat) this.onBeat(entry.event);
      }

      // Dispatch pending measure change events whose time has arrived (compensated)
      while (this.pendingMeasureChanges.length > 0 && this.pendingMeasureChanges[0].time <= now + this.UI_LATENCY_COMPENSATION) {
        const entry = this.pendingMeasureChanges.shift()!;
        if (this.onMeasureChange) this.onMeasureChange(entry.measureIndex);
      }

      this.rafHandle = requestAnimationFrame(tick);
    };

    this.rafHandle = requestAnimationFrame(tick);
  }

  /**
   * Schedule a count-in note. Uses the same sound engine but emits
   * count-in specific UI events instead of regular beat events.
   */
  private scheduleCountInNote(time: number): void {
    if (!this.audioContext) return;

    const soundType = (this.subdivisionMode === '16' && this.countInSubStep === 1)
      ? 'B'
      : (this.countInPattern[this.countInBeatIndex] || 'A');

    // Play a sound (same logic as regular notes)
    this.playSoundAtTime(time, soundType);

    // Only emit UI events on main beats (not subdivisions)
    if (this.countInSubStep === 0) {
      this.countInBeatNumber++;
      // For x/4 time, only emit display event on quarter-note boundaries
      if ((this.countInBeatNumber - 1) % this.countInDisplayInterval === 0) {
        const displayNumber = Math.ceil(this.countInBeatNumber / this.countInDisplayInterval);
        const totalDisplayBeats = Math.ceil(this.countInPattern.length / this.countInDisplayInterval);
        this.pendingCountInBeats.push({ time, beatNumber: displayNumber, totalBeats: totalDisplayBeats });
      }
    }
  }

  /**
   * Advance the count-in to the next note.
   */
  private advanceCountIn(): void {
    if (this.measures.length === 0) return;

    const currentMeasure = this.measures[this.currentMeasureIndex];
    let subBeatDuration = getSubBeatDuration(this.bpm, currentMeasure.denominator);
    if (this.subdivisionMode === '16') {
      subBeatDuration = subBeatDuration / 2;
    }

    this.nextNoteTime += subBeatDuration;

    if (this.subdivisionMode === '16') {
      this.countInSubStep = (this.countInSubStep + 1) % 2;
    } else {
      this.countInSubStep = 0;
    }

    if (this.countInSubStep === 0) {
      this.countInBeatsRemaining--;
      this.countInBeatIndex++;

      // Wrap around the pattern for the 2nd measure
      if (this.countInBeatIndex >= this.countInPattern.length) {
        this.countInBeatIndex = 0;
      }

      // Check if count-in is finished
      if (this.countInBeatsRemaining <= 0) {
        this.isCountIn = false;
        this.pendingCountInEnd.push({ time: this.nextNoteTime });
      }
    }
  }

  /**
   * Play a sound (oscillator or WAV buffer) at the given time.
   * Shared by both count-in and regular playback.
   */
  private playSoundAtTime(time: number, soundType: 'A' | 'B'): void {
    if (!this.audioContext) return;

    if (this.soundMode === 'wav' && this.bufferA && this.bufferB) {
      const source = this.audioContext.createBufferSource();
      source.buffer = soundType === 'A' ? this.bufferA : this.bufferB;
      const gain = this.audioContext.createGain();
      const gainValue = soundType === 'A' ? 1.0 : 0.7;
      gain.gain.setValueAtTime(gainValue, time);
      source.connect(gain);
      gain.connect(this.audioContext.destination);
      source.start(time);
    } else {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      if (soundType === 'A') {
        osc.frequency.value = this.ACCENT_FREQ;
        osc.type = 'sine';
        gain.gain.setValueAtTime(this.ACCENT_GAIN, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.ACCENT_DURATION);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(time);
        osc.stop(time + this.ACCENT_DURATION);
      } else {
        osc.frequency.value = this.SUB_FREQ;
        osc.type = 'sine';
        gain.gain.setValueAtTime(this.SUB_GAIN, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + this.SUB_DURATION);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(time);
        osc.stop(time + this.SUB_DURATION);
      }
    }
  }

  /**
   * Schedule a single note at the given audio time.
   */
  private scheduleNote(time: number): void {
    if (!this.audioContext || this.measures.length === 0) return;

    const soundType = (this.subdivisionMode === '16' && this.subStep === 1)
      ? 'B'
      : (this.currentPattern[this.currentBeatIndex] || 'A');

    this.playSoundAtTime(time, soundType);

    if (this.subdivisionMode !== '16' || this.subStep === 0) {
      // Queue beat event for rAF-based UI dispatch
      const event: BeatEvent = {
        measureIndex: this.currentMeasureIndex,
        beatIndex: this.currentBeatIndex,
        soundType,
        time,
      };
      this.pendingBeats.push({ time, event });
    }
  }

  /**
   * Advance to the next note, potentially crossing measure boundaries.
   */
  private advanceNote(): void {
    if (this.measures.length === 0) return;

    const currentMeasure = this.measures[this.currentMeasureIndex];
    let subBeatDuration = getSubBeatDuration(this.bpm, currentMeasure.denominator);
    if (this.subdivisionMode === '16') {
      subBeatDuration = subBeatDuration / 2;
    }

    this.nextNoteTime += subBeatDuration;

    if (this.subdivisionMode === '16') {
      this.subStep = (this.subStep + 1) % 2;
    } else {
      this.subStep = 0;
    }

    if (this.subStep === 0) {
      this.currentBeatIndex++;

      // Check if we've gone past the end of the current measure
      if (this.currentBeatIndex >= this.currentPattern.length) {
        this.currentBeatIndex = 0;
        this.currentMeasureIndex++;

        // Loop back to the beginning if we've gone past all measures
        if (this.currentMeasureIndex >= this.measures.length) {
          this.currentMeasureIndex = 0;
        }

        this.updateCurrentPattern();

        // Auto-snap or scale BPM when the measure changes
        const newMeasure = this.measures[this.currentMeasureIndex];
        if (this.bpmMode === 'multiplier') {
          this.bpm = Math.max(20, Math.min(400, Math.round(newMeasure.target_bpm * this.multiplier)));
        } else {
          // In 'fixed' mode, we do NOT change this.bpm. It remains at the fixed user-set value.
        }

        // Queue measure change event for rAF-based UI dispatch
        this.pendingMeasureChanges.push({
          time: this.nextNoteTime,
          measureIndex: this.currentMeasureIndex,
        });
      }
    }
  }

  /**
   * Update the beat pattern for the current measure.
   */
  private updateCurrentPattern(): void {
    if (this.measures.length === 0) {
      this.currentPattern = ['A'];
      return;
    }
    const measure = this.measures[this.currentMeasureIndex];
    this.currentPattern = getBeatPattern(measure);
  }
}
