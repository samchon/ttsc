import fs from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

/**
 * Reads actual per-writer observations after the coordinator has joined them.
 * This reports observed populations only. An empty integrity list does not
 * prove that every intended primitive or upstream Program route was observed.
 * The coordinator must separately bind prepared tool identities, required
 * writers, profile boundaries and the documented unobserved population.
 *
 * @evidence contracts/common.md#principled-implementation Validates actual writer identity/sequence and counts distinct observed process invocations and constructor events. Load outcomes and reused data are separate from construction cost; pointer labels are never generation dedup keys.
 * @evidence contracts/common.md#clear-and-simple-design One reader produces observed counters and explicit integrity problems, leaving preparation scope and completeness certification to the coordinator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing writers, corrupt rows, incomplete attempts and integrity markers are not replaced with expected counts or successful measurements. Raw/upstream Program construction is not inferred from maintained driver counters.
 * @evidence contracts/common.md#meaningful-documentation Explains after-join timing, observed-only scope, writer manifests and the difference between data reuse and a new Program object.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native file/path operations and recorded numeric PIDs without OS-name-derived process outcomes or path case folding.
 * @evidence contracts/performance.md#efficient-algorithms Visits each writer file and JSONL row once, with indexes for sequence/actual invocation identity. Complete file/text/parsed values occupy memory proportional to observed bytes and events.
 * @evidence contracts/performance.md#reuse-equivalent-work One parsed stream contributes all counters and integrity checks; a previous measurement or process outcome is never reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads close before returning. JSONL is bounded per writer at256MiB; no payload bytes are loaded here. Actual writer/child joins and trace-root retention remain coordinator responsibilities.
 */
export function readE2eTraceMeasurements(
  root: string,
  requiredWriterPids: readonly number[],
): TraceMeasurements {
  const result: TraceMeasurements = {
    observedOnly: true,
    writerInstances: 0,
    processAttempts: 0,
    processStarts: 0,
    processExits: 0,
    processCloses: 0,
    incompleteProcessInvocations: [],
    programConstructions: { fullLoad: 0, fullReconstruction: 0, reusedDataGeneration: 0, other: 0 },
    installedDriverFacades: 0,
    bridgeCacheHits: 0,
    integrityProblems: [],
  };
  const writerPids = new Set<number>();
  const writerInstances = new Set<string>();
  const sequences = new Map<string, number>();
  const attempts = new Set<string>();
  const starts = new Set<string>();
  const exits = new Set<string>();
  const closes = new Set<string>();
  const results = new Set<string>();
  for (const name of fs.readdirSync(root)) {
    if (name.endsWith(".integrity")) {
      result.integrityProblems.push("Writer integrity marker: " + name);
      continue;
    }
    if (!name.endsWith(".jsonl")) continue;
    const file = path.join(root, name);
    const size = fs.statSync(file).size;
    if (size > 256 * 1024 * 1024) {
      result.integrityProblems.push("Writer exceeds observation limit: " + name);
      continue;
    }
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file)); }
    catch (error) {
      result.integrityProblems.push("Unreadable UTF8 writer: " + name + ": " + String(error));
      continue;
    }
    if (!text.endsWith("\n")) result.integrityProblems.push("Unterminated writer row: " + name);
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
      if (line === "" && index === lines.length - 1) continue;
      let event: TraceEvent;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!isTraceEvent(parsed)) throw new Error("Invalid schema1 core fields");
        event = parsed;
      } catch (error) {
        result.integrityProblems.push(`${name}:${index + 1}: ${String(error)}`);
        continue;
      }
      if (name !== `${event.writerPid}-${event.instance}.jsonl`) {
        result.integrityProblems.push("Writer filename/identity mismatch: " + name);
        continue;
      }
      const writer = `${event.writerPid}:${event.instance}`;
      writerInstances.add(writer);
      writerPids.add(event.writerPid);
      const expected = (sequences.get(writer) ?? 0) + 1;
      if (event.sequence !== expected)
        result.integrityProblems.push(`${name}: expected sequence${expected}, observed${event.sequence}`);
      sequences.set(writer, event.sequence);
      const invocation = writer + ":" + event.invocation;
      if (event.event.startsWith("process-")) {
        if (event.event === "process-attempt") attempts.add(invocation);
        if (event.event === "process-result") results.add(invocation);
        const started = event.started ?? event.data?.started;
        if (typeof event.pid === "number" && event.pid > 0 &&
          (started === true || event.event === "process-start" ||
            event.event === "process-exit" || event.event === "process-close"))
          starts.add(invocation);
        if (event.event === "process-exit" ||
          (event.event === "process-result" && (event.exitObserved ?? event.data?.exitObserved) === true))
          exits.add(invocation);
        if (event.event === "process-close") closes.add(invocation);
      } else if (event.event === "program-construction") {
        const data = event.data;
        if (data?.origin === "driver-create") result.programConstructions.fullLoad++;
        else if (data?.origin === "driver-update" && data.reusedData === true)
          result.programConstructions.reusedDataGeneration++;
        else if (data?.origin === "driver-update" && data.reusedData === false)
          result.programConstructions.fullReconstruction++;
        else result.programConstructions.other++;
      } else if (event.event === "program-load-outcome" && event.data?.outcome === "facade-installed") {
        result.installedDriverFacades++;
      } else if (event.event === "bridge-cache-hit") {
        result.bridgeCacheHits++;
      }
    }
  }
  for (const pid of requiredWriterPids)
    if (!writerPids.has(pid)) result.integrityProblems.push("Missing required instrumented writer PID: " + pid);
  for (const invocation of attempts)
    if (!results.has(invocation) && !closes.has(invocation)) result.incompleteProcessInvocations.push(invocation);
  result.writerInstances = writerInstances.size;
  result.processAttempts = attempts.size;
  result.processStarts = starts.size;
  result.processExits = exits.size;
  result.processCloses = closes.size;
  return result;
}

/** Recorded fields are observations, not normalized product protocol values. */
interface TraceEvent {
  schema: 1;
  event: string;
  writerPid: number;
  instance: string;
  sequence: number;
  invocation: string;
  at: string;
  pid?: number | null;
  started?: boolean;
  exitObserved?: boolean;
  data?: Record<string, unknown>;
}

/** Counters intentionally omit an asserted total-upstream-Program quantity. */
export interface TraceMeasurements {
  observedOnly: true;
  writerInstances: number;
  processAttempts: number;
  processStarts: number;
  processExits: number;
  processCloses: number;
  /** Attempts without result/close observation; present result does not certify descendants or an async child's close. */
  incompleteProcessInvocations: string[];
  programConstructions: { fullLoad: number; fullReconstruction: number; reusedDataGeneration: number; other: number };
  installedDriverFacades: number;
  bridgeCacheHits: number;
  integrityProblems: string[];
}

/** Rejects malformed event cores without manufacturing missing observations. */
function isTraceEvent(value: unknown): value is TraceEvent {
  if (value === null || typeof value !== "object") return false;
  const event = value as Partial<TraceEvent>;
  return event.schema === 1 && typeof event.event === "string" &&
    Number.isSafeInteger(event.writerPid) && (event.writerPid ?? 0) > 0 &&
    typeof event.instance === "string" && event.instance.length > 0 &&
    Number.isSafeInteger(event.sequence) && (event.sequence ?? 0) > 0 &&
    typeof event.invocation === "string" && event.invocation.startsWith(event.instance + ":") &&
    typeof event.at === "string" && Number.isFinite(Date.parse(event.at)) &&
    (event.pid === null || (Number.isSafeInteger(event.pid) && (event.pid ?? -1) >= 0) ||
      (event.pid === undefined && !event.event.startsWith("process-"))) &&
    (event.data === undefined || (event.data !== null && typeof event.data === "object" && !Array.isArray(event.data)));
}
