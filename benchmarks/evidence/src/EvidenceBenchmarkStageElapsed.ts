import fs from "node:fs";
import path from "node:path";

/**
 * Wall-clock time each objective actually held the thread, read from
 * `events.jsonl`.
 *
 * A Goal's own `elapsedMs` accumulates from `turn/completed` alone, so a turn
 * that is killed contributes nothing to the stage that ran it. The dashboard
 * used to hand every unattributed millisecond to whichever stage was current
 * when it rendered, which credits one stage with time it did not exist for: in
 * this cohort `todo` Plain's `backend-remind-1` was reported at 1h 44m while
 * its stage log spanned 1h 19m, because `backend-review` had been killed five
 * times and its time had nowhere else to go.
 *
 * Here the interval between two consecutive events of the same process belongs
 * to the stage the earlier one carried, and a process crossing into a window
 * where no runner was alive contributes nothing. What a process spent after its
 * last line — a turn that ran silently, and every hung turn — belongs to the
 * stage that process was last in, so the totals still reconcile to the run's
 * work time rather than quietly shrinking to what happened to be chatty.
 *
 * The stream reaches hundreds of megabytes per cell while eight of them are
 * being measured on one machine, so the scan is incremental: each pass reads
 * only the bytes appended since the last one and folds them into a cached
 * index. The cache is derived, never a measurement — delete it and the next
 * pass rebuilds it from the record.
 */
export namespace EvidenceBenchmarkStageElapsed {
  /** One cached fold over a prefix of an event stream. */
  interface IIndex {
    /** Bytes of `events.jsonl` already folded in. */
    offset: number;
    /** Milliseconds attributed to each stage name. */
    byStage: Record<string, number>;
    /** Observation window each stage was seen in, for suspension overlap. */
    windowByStage: Record<string, { first: number; last: number }>;
    /** Last event of each process index, by observation time and stage. */
    byProcess: Record<string, { at: number; stage: string; elapsedMs: number }>;
  }

  const CACHE = ".stage-elapsed.json";

  /**
   * Folds the stream and returns milliseconds per stage name.
   *
   * `processElapsedMs` supplies each process's own retained clock so trailing
   * silence lands on the stage that owned it; a process the caller does not
   * name contributes only what its events show.
   */
  export function read(
    events: string,
    processElapsedMs: ReadonlyMap<number, number>,
    suspensions: readonly { startedAt: string; elapsedMs: number }[] = [],
  ): Map<string, number> {
    if (!fs.existsSync(events)) return new Map();
    const cache: string = path.join(path.dirname(events), CACHE);
    const index: IIndex = fold(events, load(cache, events));
    save(cache, index);

    const found: Map<string, number> = new Map(
      Object.entries(index.byStage).map(([stage, ms]) => [stage, ms]),
    );
    // Time a process spent after its last line belongs to the stage it was in.
    for (const [key, last] of Object.entries(index.byProcess)) {
      const retained: number | undefined = processElapsedMs.get(Number(key));
      if (retained === undefined) continue;
      const silent: number = retained - last.elapsedMs;
      if (silent <= 0) continue;
      found.set(last.stage, (found.get(last.stage) ?? 0) + silent);
    }
    // A verified idle interval is removed from the stage whose own observation
    // window contains it, so a suspended machine does not inflate whichever
    // stage was running when it slept.
    for (const suspension of suspensions) {
      const from: number = Date.parse(suspension.startedAt);
      if (Number.isNaN(from)) continue;
      const to: number = from + suspension.elapsedMs;
      for (const [stage, window] of Object.entries(index.windowByStage)) {
        const overlap: number =
          Math.min(to, window.last) - Math.max(from, window.first);
        if (overlap <= 0) continue;
        found.set(stage, Math.max(0, (found.get(stage) ?? 0) - overlap));
      }
    }
    return found;
  }

  const load = (cache: string, events: string): IIndex => {
    const empty: IIndex = {
      offset: 0,
      byStage: {},
      windowByStage: {},
      byProcess: {},
    };
    if (!fs.existsSync(cache)) return empty;
    try {
      const value: IIndex = JSON.parse(
        fs.readFileSync(cache, "utf8"),
      ) as IIndex;
      // A stream that shrank is a different stream; rebuild rather than resume
      // a fold whose prefix no longer exists.
      if (
        typeof value.offset !== "number" ||
        value.offset > fs.statSync(events).size
      )
        return empty;
      return {
        offset: value.offset,
        byStage: value.byStage ?? {},
        windowByStage: value.windowByStage ?? {},
        byProcess: value.byProcess ?? {},
      };
    } catch {
      return empty;
    }
  };

  const save = (cache: string, index: IIndex): void => {
    try {
      fs.writeFileSync(cache, JSON.stringify(index));
    } catch {
      // A cache that cannot be written costs a rescan, never a measurement.
    }
  };

  const fold = (events: string, index: IIndex): IIndex => {
    const size: number = fs.statSync(events).size;
    if (size <= index.offset) return index;
    const descriptor: number = fs.openSync(events, "r");
    try {
      let position: number = index.offset;
      let carry: string = "";
      const buffer: Buffer = Buffer.alloc(4 * 1024 * 1024);
      while (position < size) {
        const length: number = fs.readSync(
          descriptor,
          buffer,
          0,
          Math.min(buffer.length, size - position),
          position,
        );
        if (length <= 0) break;
        const text: string = `${carry}${buffer.toString("utf8", 0, length)}`;
        const lines: string[] = text.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) consume(index, line);
        position += length;
        // Only whole lines are folded, so the next pass resumes at the last
        // newline rather than re-reading or skipping a partial record.
        index.offset = position - Buffer.byteLength(carry, "utf8");
      }
    } finally {
      fs.closeSync(descriptor);
    }
    return index;
  };

  const consume = (index: IIndex, line: string): void => {
    const trimmed: string = line.trim();
    if (trimmed.length === 0) return;
    let value: {
      processIndex?: unknown;
      recordedAt?: unknown;
      stage?: unknown;
      elapsedMs?: unknown;
    };
    try {
      value = JSON.parse(trimmed) as typeof value;
    } catch {
      return;
    }
    if (
      typeof value.processIndex !== "number" ||
      typeof value.recordedAt !== "string" ||
      typeof value.stage !== "string" ||
      typeof value.elapsedMs !== "number"
    )
      return;
    const at: number = Date.parse(value.recordedAt);
    if (Number.isNaN(at)) return;
    const window = index.windowByStage[value.stage];
    if (window === undefined)
      index.windowByStage[value.stage] = { first: at, last: at };
    else {
      if (at < window.first) window.first = at;
      if (at > window.last) window.last = at;
    }
    const key: string = String(value.processIndex);
    const previous = index.byProcess[key];
    if (previous !== undefined && at >= previous.at)
      index.byStage[previous.stage] =
        (index.byStage[previous.stage] ?? 0) + (at - previous.at);
    index.byProcess[key] = {
      at,
      stage: value.stage,
      elapsedMs: value.elapsedMs,
    };
  };
}
