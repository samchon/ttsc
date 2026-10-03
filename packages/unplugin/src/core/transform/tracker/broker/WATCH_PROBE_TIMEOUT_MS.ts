/**
 * How long a watch backend is given to prove it delivers, before the watch is
 * given up as one that cannot: the wait for a directory watch to report ready,
 * and the wait for a probe written to a macOS stream to come back through it
 * (samchon/ttsc#1453).
 *
 * Expiry withdraws this observation's delivery authority, not proof that the
 * backend can never deliver. Native latency, scheduling and unsupported
 * coverage can all miss the threshold. Owners fail or mark unproven watches
 * and retain state validation instead of treating timeout as acknowledgment;
 * actual callback execution still depends on event-loop progress.
 */
export const WATCH_PROBE_TIMEOUT_MS = 10_000;
