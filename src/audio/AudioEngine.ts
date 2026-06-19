import type { MeasureData, BeatEvent } from '../types/song';
import { getBeatPattern, getSubBeatDuration } from '../utils/songParser';

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

  // Playback state
  private currentMeasureIndex = 0;
  private currentBeatIndex = 0;
  private nextNoteTime = 0;
  private bpm = 120;

  // Song data
  private measures: MeasureData[] = [];
  private currentPattern: ('A' | 'B')[] = [];

  // Callbacks
  private onBeat: ((event: BeatEvent) => void) | null = null;
  private onMeasureChange: ((measureIndex: number) => void) | null = null;

  // Pending UI events queue — events are scheduled ahead of time and
  // dispatched when audioContext.currentTime reaches their time.
  private pendingBeats: { time: number; event: BeatEvent }[] = [];
  private pendingMeasureChanges: { time: number; measureIndex: number }[] = [];

  // Latency compensation (in seconds) to align visual flash with audio arrival.
  // We dispatch UI events slightly before the actual audio time to account for React render + screen refresh delay.
  private readonly UI_LATENCY_COMPENSATION = 0.015; // 15ms early

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
  }

  /**
   * Set the song data (array of measures).
   */
  setMeasures(measures: MeasureData[]): void {
    this.measures = measures;
    this.updateCurrentPattern();
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
   * Jump to a specific measure and beat.
   */
  jumpTo(measureIndex: number, beatIndex = 0): void {
    if (measureIndex < 0 || measureIndex >= this.measures.length) return;
    this.currentMeasureIndex = measureIndex;
    this.currentBeatIndex = beatIndex;
    this.updateCurrentPattern();

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
      this.scheduleNote(this.nextNoteTime);
      this.advanceNote();
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
   * Schedule a single note at the given audio time.
   */
  private scheduleNote(time: number): void {
    if (!this.audioContext || this.measures.length === 0) return;

    const soundType = this.currentPattern[this.currentBeatIndex] || 'A';

    // Create oscillator for this beat
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

    // Queue beat event for rAF-based UI dispatch
    const event: BeatEvent = {
      measureIndex: this.currentMeasureIndex,
      beatIndex: this.currentBeatIndex,
      soundType,
      time,
    };
    this.pendingBeats.push({ time, event });
  }

  /**
   * Advance to the next note, potentially crossing measure boundaries.
   */
  private advanceNote(): void {
    if (this.measures.length === 0) return;

    const currentMeasure = this.measures[this.currentMeasureIndex];
    const subBeatDuration = getSubBeatDuration(this.bpm, currentMeasure.denominator);

    this.nextNoteTime += subBeatDuration;
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

      // Auto-snap BPM when the score's target_bpm changes between measures
      const prevMeasure = this.measures[
        this.currentMeasureIndex === 0 ? this.measures.length - 1 : this.currentMeasureIndex - 1
      ];
      const newMeasure = this.measures[this.currentMeasureIndex];
      if (newMeasure.target_bpm !== prevMeasure.target_bpm) {
        this.bpm = newMeasure.target_bpm;
      }

      // Queue measure change event for rAF-based UI dispatch
      this.pendingMeasureChanges.push({
        time: this.nextNoteTime,
        measureIndex: this.currentMeasureIndex,
      });
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
