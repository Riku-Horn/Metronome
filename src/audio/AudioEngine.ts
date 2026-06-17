import type { MeasureData, BeatEvent } from '../types/song';
import { getBeatPattern, getSubBeatDuration } from '../utils/songParser';

/**
 * High-precision metronome audio engine using Web Audio API.
 * Implements Chris Wilson's look-ahead scheduling pattern for
 * sample-accurate timing that doesn't drift even under heavy load
 * or when the browser tab is in the background.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private schedulerTimer: number | null = null;
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

    if (this.isPlaying && this.audioContext) {
      // Reset the next note time to now
      this.nextNoteTime = this.audioContext.currentTime;
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

    // Start the scheduler loop
    this.schedulerTimer = window.setInterval(() => {
      this.scheduler();
    }, this.SCHEDULE_INTERVAL);
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

    // Emit beat event for UI synchronization
    if (this.onBeat) {
      // Calculate delay from now to when the beat actually plays
      const delay = Math.max(0, (time - this.audioContext.currentTime) * 1000);
      const event: BeatEvent = {
        measureIndex: this.currentMeasureIndex,
        beatIndex: this.currentBeatIndex,
        soundType,
        time,
      };
      if (delay < 5) {
        this.onBeat(event);
      } else {
        setTimeout(() => {
          if (this.onBeat) this.onBeat(event);
        }, delay);
      }
    }
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

      if (this.onMeasureChange) {
        // Fire measure change with similar timing compensation
        const delay = Math.max(0,
          this.audioContext
            ? (this.nextNoteTime - this.audioContext.currentTime) * 1000
            : 0
        );
        const idx = this.currentMeasureIndex;
        if (delay < 5) {
          this.onMeasureChange(idx);
        } else {
          setTimeout(() => {
            if (this.onMeasureChange) this.onMeasureChange(idx);
          }, delay);
        }
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
