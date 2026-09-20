/**
 * How long a watch backend is given to prove it delivers, before the watch is
 * given up as one that cannot: the wait for a directory watch to report ready,
 * and the wait for a probe written to a macOS stream to come back through it
 * (samchon/ttsc#1453).
 *
 * A backend that delivers answers in milliseconds; only one that does not
 * deliver at all, such as FSEvents on a volume it does not cover or a helper
 * that died, runs this out. The watch then fails, and its tracker's silence is
 * never read as proof again. Every delivery keeps validating against the
 * recorded state instead, so a slower answer costs a proof, never a stale
 * output.
 */
export const WATCH_PROBE_TIMEOUT_MS = 10_000;
