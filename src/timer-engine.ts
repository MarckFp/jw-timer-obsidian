import type { TimerState } from "./types";

export type TimerStatus = "idle" | "running" | "paused";

export interface TimerSnapshot {
  elapsedMs: number;
  status: TimerStatus;
}

export class TimerEngine {
  private states = new Map<string, TimerState>();

  private key(weekKey: string, partOrder: number): string {
    return `${weekKey}:${partOrder}`;
  }

  get(weekKey: string, partOrder: number): TimerSnapshot {
    const state = this.states.get(this.key(weekKey, partOrder));
    if (!state) return { elapsedMs: 0, status: "idle" };
    const elapsed = state.running && state.startedAt !== null
      ? state.elapsedMs + (Date.now() - state.startedAt)
      : state.elapsedMs;
    const status: TimerStatus = state.running ? "running" : state.elapsedMs > 0 ? "paused" : "idle";
    return { elapsedMs: elapsed, status };
  }

  start(weekKey: string, partOrder: number): void {
    const k = this.key(weekKey, partOrder);
    const existing = this.states.get(k);
    if (existing?.running) return;
    this.states.set(k, {
      partOrder,
      elapsedMs: existing?.elapsedMs ?? 0,
      running: true,
      startedAt: Date.now(),
    });
  }

  pause(weekKey: string, partOrder: number): void {
    const k = this.key(weekKey, partOrder);
    const state = this.states.get(k);
    if (!state?.running) return;
    this.states.set(k, {
      ...state,
      elapsedMs: state.elapsedMs + (Date.now() - (state.startedAt ?? Date.now())),
      running: false,
      startedAt: null,
    });
  }

  reset(weekKey: string, partOrder: number): void {
    this.states.delete(this.key(weekKey, partOrder));
  }

  /** Snapshot all states for persistence, freezing running timers. */
  snapshotAll(): Map<string, TimerState> {
    const result = new Map<string, TimerState>();
    for (const [k, state] of this.states) {
      if (state.running && state.startedAt !== null) {
        result.set(k, {
          ...state,
          elapsedMs: state.elapsedMs + (Date.now() - state.startedAt),
          running: false,
          startedAt: null,
        });
      } else {
        result.set(k, { ...state });
      }
    }
    return result;
  }

  /** Restore states from persisted data (all paused). */
  restore(saved: Record<string, TimerState>): void {
    this.states.clear();
    for (const [k, state] of Object.entries(saved)) {
      this.states.set(k, { ...state, running: false, startedAt: null });
    }
  }
}
