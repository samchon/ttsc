import type { ChildProcess, SpawnSyncOptions, SpawnSyncReturns } from "node:child_process";
import crypto from "node:crypto";
import { errorMonitor } from "node:events";
import fs from "node:fs";
import path from "node:path";

/**
 * Private opt-in observations of maintained process primitives and separately
 * classified runtime source preparation inputs.
 *
 * TTSC_E2E_TRACE selects coordinator-owned scratch. Each writer owns one JSONL
 * and its raw returned-buffer payloads. Returned strings are recorded as text,
 * without claiming their encoding reconstructs original process bytes.
 * Missing or invalid evidence is a
 * measurement failure, never permission to change a product result. Times are
 * call bounds; a synchronous return does not reveal an exact OS start time or
 * descendant close. No trace output is written to product streams.
 *
 * @evidence contracts/common.md#principled-implementation Actual primitive call bounds and returned PID/status/signal/error/output remain separate from source-preparation input observations; failed admission or sink writes do not synthesize success or replace product results.
 * @evidence contracts/common.md#clear-and-simple-design A private token connects one attempt and returned result; per-process writer state owns serialization, payload budget and append-close IO.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The helper neither patches child_process nor infers launches from wrapper call counts; no tests/utils or public product API is introduced.
 * @evidence contracts/common.md#meaningful-documentation Native prose separates observation from lifecycle ownership and documents opt-in failure and time-bound limitations.
 * @evidence contracts/portability.md#os-neutral-implementation Native Node path and filesystem APIs admit an absolute scratch root; argv/cwd retain selected representations and returned PID/signal are native observations, not shell syntax or OS defaults.
 * @evidence contracts/performance.md#efficient-algorithms Each event serializes its actual metadata and returned payload bytes. JSON encoding and string-to-byte conversion temporarily precede budget admission; encoded metadata and payload IO scale with those inputs and add synchronous latency.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each primitive invocation has independent effects; matching command/argv cannot share its observation as a new execution.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One writer retains root/nonce/counters until process exit. Each sink write closes in finally; payloads are capped at 64MiB each and writer output at 256MiB including reserved integrity metadata. Coordinator owns scratch reclamation and writer/child settlement; IO failure can leave partial files and missing evidence.
 */
export namespace E2ETrace {
  /**
   * Observe the actual source string before CommonJS preparation, not a launch.
   * UTF-16LE preserves JavaScript code units, including unpaired surrogates;
   * these bytes represent the consumed string, not original disk or emit bytes.
   * Disabled tracing performs no sink IO or source conversion. Observer failure
   * leaves the caller's preparation and exception behavior untouched.
   *
   * @evidence contracts/common.md#principled-implementation The caller supplies its already-read source, filename and selected format; the observation precedes the unchanged preparation without certifying parsing success or executable identity.
   * @evidence contracts/common.md#clear-and-simple-design One non-process event and bounded raw-string payload use the existing private writer, invocation schema and integrity policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No source is reconstructed, product result replaced, syntax admitted, or launch inferred from this observation; no public product API or test dependency is introduced.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes consumed UTF-16 code units from disk bytes, process starts and preparation success.
   * @evidence contracts/portability.md#os-neutral-implementation Native filenames and selected format remain caller metadata; Node's explicit utf16le encoding preserves source code units without filesystem case or module-format guessing.
   * @evidence contracts/performance.md#efficient-algorithms Enabled source conversion and payload IO scale with twice the source code-unit count; metadata encoding and synchronous sink IO add latency. Disabled tracing returns before conversion, and oversized source is rejected before allocation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each preparation observation concerns its actual caller input, not a shared compilation or historical execution answer.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation retains no source history or handle; the existing writer owns bounded payload writes, failure metadata and coordinator-owned scratch cleanup.
   */
  export function runtimePreparation(
    source: string,
    filename: string,
    selectedFormat: string,
    origin: string,
  ): void {
    const selected = process.env.TTSC_E2E_TRACE;
    if (!selected) return;
    try {
      if (!admit(selected)) return;
      const token: Token = {
        invocation: String(++ordinal),
        argv: [...process.argv],
        cwd: process.cwd(),
        lower: new Date().toISOString(),
        origin,
        argv0: null,
      };
      if (source.length > PAYLOAD_LIMIT / 2) {
        integrity(token, "payload-budget-exceeded");
        return;
      }
      const sourcePayload = payload(token, "runtime-source", Buffer.from(source, "utf16le"));
      event(token, "runtime-source-preparation", process.pid, {
        origin, filename, selectedFormat, source: sourcePayload,
        sourceEncoding: "utf16le", sourceCodeUnits: source.length,
        representation: "consumed-javascript-string",
      });
    } catch { failed = true; }
  }

  /**
   * Observe supported child events without taking transport or kill ownership.
   * Error monitoring preserves Node's ordinary unhandled-error behavior. Close
   * releases these listeners; an unclosed child can retain them indefinitely.
   *
   * @evidence contracts/common.md#principled-implementation Actual spawn, exit and close events remain distinct; native child PID and code/signal are observations, not inferred wrapper counts or descendant joins.
   * @evidence contracts/common.md#clear-and-simple-design One token owns four observation callbacks on the actual maintained ChildProcess and removes remaining callbacks at close.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported event listeners and errorMonitor neither replace foreign methods nor convert an unhandled error into handled success; process streams are not consumed here.
   * @evidence contracts/common.md#meaningful-documentation Native prose states event ownership, error behavior and unclosed-listener retention.
   * @evidence contracts/portability.md#os-neutral-implementation Node's spawn/exit/close events and returned native PID/code/signal supply platform observations without guessed Unix state or exact OS start time.
   * @evidence contracts/performance.md#efficient-algorithms Four listener registrations and bounded event count add actual metadata/error-byte serialization and native sink IO; caller event-loop scheduling and child runtime remain delegated.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work One actual child's lifecycle cannot certify an equivalent second launch.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Observation callbacks retain the token/child until actual close and then remove remaining listeners. No deadline or child termination is introduced; a caller's release of event-loop reference does not prove close.
   */
  export function asynchronous(token: Token | undefined, child: ChildProcess): void {
    if (token === undefined || failed) return;
    const upper = new Date().toISOString();
    const observe = (kind: string, data: Record<string, unknown>) => {
      try {
        event(token, kind, child.pid ?? null, data, upper);
      } catch { failed = true; }
    };
    const onSpawn = () => observe("process-start", { origin: token.origin, started: true });
    const onExit = (status: number | null, signal: NodeJS.Signals | null) =>
      observe("process-exit", { origin: token.origin, status, signal, exitObserved: true });
    const onError = (error: Error) => observe("process-result", {
      origin: token.origin, started: child.pid !== undefined,
      outcome: "async-error", error: { name: error.name, message: error.message },
    });
    const onClose = (status: number | null, signal: NodeJS.Signals | null) => {
      child.removeListener("spawn", onSpawn);
      child.removeListener("exit", onExit);
      child.removeListener(errorMonitor, onError);
      observe("process-close", { origin: token.origin, status, signal });
    };
    child.once("spawn", onSpawn);
    child.once("exit", onExit);
    child.once(errorMonitor, onError);
    child.once("close", onClose);
  }

  /**
   * Observe exactly one caller-owned synchronous primitive, preserving its
   * returned object and any thrown exception. A thrown call leaves an attempt
   * without a result, which cannot certify completed process observation.
   *
   * @evidence contracts/common.md#principled-implementation The operation is called once and its same result is returned; observer failure cannot substitute a command outcome.
   * @evidence contracts/common.md#clear-and-simple-design This boundary pairs the shared before/after observer around a maintained actual primitive.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign spawn method is replaced; maintained owners supply their unchanged actual call rather than reconstructed source.
   * @evidence contracts/common.md#meaningful-documentation Native prose states result identity, exception preservation and incomplete-attempt scope.
   * @evidence contracts/portability.md#os-neutral-implementation Selected native command/argv/cwd accompany the actual returned Node PID/status/signal; the observer does not reinterpret the platform.
   * @evidence contracts/performance.md#efficient-algorithms One primitive call delegates observer metadata/output-byte and native IO cost before returning; no retries or output traversals beyond the trace sink are added here.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work An independent effectful primitive call cannot be replaced with a matching historical result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The actual call owner retains process/output authority; the namespace sink owns trace-file writes and coordinator cleanup.
   */
  export function synchronous<Result extends SpawnSyncReturns<string | Buffer>>(
    command: string,
    args: readonly string[],
    options: Pick<SpawnSyncOptions, "cwd" | "argv0">,
    origin: string,
    operation: () => Result,
    coordinatorRoot = process.env.TTSC_E2E_TRACE,
  ): Result {
    const token = begin(command, args, options, origin, coordinatorRoot);
    const returned = operation();
    result(token, returned);
    return returned;
  }

  /**
   * Observation metadata, not a process handle or execution authority.
   *
   * @evidence contracts/common.md#principled-implementation One invocation identity pairs selected arguments with honest before/after call bounds; no PID is claimed before native return.
   * @evidence contracts/common.md#clear-and-simple-design A token holds only invocation metadata while module state owns the sink.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fields do not substitute for a ChildProcess or certify start/close.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes observation metadata from execution ownership.
   * @evidence contracts/portability.md#os-neutral-implementation Command/argv and optional cwd retain the native spawn inputs; inherited cwd is represented separately from explicit selection.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This token declares fields, not the observer algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This value coordinates no equivalent execution reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This value owns no process or file handle; writer and caller own their lifetimes.
   */
  export interface Token {
    /** Writer-local ordinal; writer pid and nonce complete its identity. */
    invocation: string;

    /** Selected process inputs, or actual writer argv for source observation. */
    argv: string[];

    /** Explicit cwd representation, or null for inherited cwd intent. */
    cwd: string | null;

    /** UTC bound before the owning primitive or preparation observation. */
    lower: string;

    /** Maintained observation owner, not an inferred child phase. */
    origin: string;

    /** Explicit argv[0] override, or null for the primitive's default. */
    argv0: string | null;
  }

  /**
   * Observe before one actual synchronous primitive, with disabled sink IO zero.
   * The generated private broker can pass the same coordinator root through
   * its internal arguments without changing the target's supplied environment.
   *
   * @evidence contracts/common.md#principled-implementation Empty opt-in returns undefined before sink work; native call execution remains entirely with the caller.
   * @evidence contracts/common.md#clear-and-simple-design Admission and one attempt event return a small token for the same call.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation failures return no token rather than changing command execution or printing to its streams.
   * @evidence contracts/common.md#meaningful-documentation Purpose and timing are explicit in native prose and token fields.
   * @evidence contracts/portability.md#os-neutral-implementation Node validates an absolute coordinator root; cwd preserves supplied path/URL spelling or records inherited intent.
   * @evidence contracts/performance.md#efficient-algorithms Argument copying and cwd text plus delegated sink encoding/native IO scale with input bytes; disabled mode returns before copying.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This observes an independent effectful call, not a reusable completed computation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned metadata token owns no handle; namespace writer and actual spawn owner control resource lifetimes.
   */
  export function begin(
    command: string,
    args: readonly string[],
    options: Pick<SpawnSyncOptions, "cwd" | "argv0">,
    origin: string,
    coordinatorRoot = process.env.TTSC_E2E_TRACE,
  ): Token | undefined {
    if (!coordinatorRoot) return undefined;
    try {
      if (!admit(coordinatorRoot)) return undefined;
      const token: Token = {
        invocation: String(++ordinal),
        argv: [command, ...args],
        cwd: options.cwd === undefined ? null : String(options.cwd),
        lower: new Date().toISOString(),
        origin,
        argv0: options.argv0 ?? null,
      };
      event(token, "process-attempt", null, {
        origin, cwdInherited: options.cwd === undefined, argv0: token.argv0,
      });
      return token;
    } catch {
      failed = true;
      return undefined;
    }
  }

  /**
   * Record a returned primitive result without claiming a child close event.
   *
   * @evidence contracts/common.md#principled-implementation Native returned PID/status/signal/error and original returned buffers/string values remain distinct from attempt metadata and product outcomes; encoded returned text is not certified original child bytes.
   * @evidence contracts/common.md#clear-and-simple-design One result event connects the token to optional raw stdout/stderr payload references.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed or missing PID is not counted as a launch; observer exceptions never replace the result.
   * @evidence contracts/common.md#meaningful-documentation Native prose states returned-result scope and absence of descendant-close proof.
   * @evidence contracts/portability.md#os-neutral-implementation Status and signal are used as returned by Node; there is no POSIX interpretation of Windows status or guessed start timestamp.
   * @evidence contracts/performance.md#efficient-algorithms Actual returned text/buffer conversion, payload writes and metadata/error serialization scale with their bytes; budget admission does not bound prior conversion allocation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every returned result belongs to its own observed call and cannot stand in for another invocation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Result observation acquires no child ownership; namespace sink closes writes and coordinator retains/reclaims files after settlement.
   */
  export function result(
    token: Token | undefined,
    returned: SpawnSyncReturns<string | Buffer>,
  ): void {
    if (token === undefined || failed) return;
    const upper = new Date().toISOString();
    try {
      const error = returned.error as NodeJS.ErrnoException | undefined;
      const stdout = payload(token, "stdout", returned.stdout);
      const stderr = payload(token, "stderr", returned.stderr);
      event(token, "process-result", returned.pid > 0 ? returned.pid : null, {
        origin: token.origin,
        started: returned.pid > 0,
        exitObserved: returned.status !== null || returned.signal !== null,
        status: returned.status,
        signal: returned.signal,
        error: error === undefined ? null : {
          name: error.name,
          message: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
        },
        stdout,
        stderr,
      }, upper);
    } catch {
      failed = true;
    }
  }
}

const WRITER_LIMIT = 256 * 1024 * 1024;
const PAYLOAD_LIMIT = 64 * 1024 * 1024;
const FAILURE_RESERVE = 1024 * 1024;
let root: string | undefined;
let instance: string | undefined;
let ordinal = 0;
let sequence = 0;
let bytes = 0;
let failed = false;

function admit(selected: string): boolean {
  if (failed) return false;
  if (root !== undefined) return true;
  if (!path.isAbsolute(selected)) return false;
  instance = crypto.randomBytes(16).toString("hex");
  root = selected;
  return true;
}

function append(value: Buffer): void {
  const fd = fs.openSync(path.join(root!, `${process.pid}-${instance}.jsonl`), "a", 0o600);
  try {
    let offset = 0;
    while (offset < value.length) {
      const written = fs.writeSync(fd, value, offset, value.length - offset);
      if (written <= 0) throw new Error("trace short write");
      offset += written;
      bytes += written;
    }
  } finally {
    fs.closeSync(fd);
  }
}

function event(
  token: E2ETrace.Token,
  kind: string,
  pid: number | null,
  data: Record<string, unknown>,
  upper?: string,
): void {
  if (failed) return;
  const record = {
    schema: 1, event: kind, writerPid: process.pid, instance,
    sequence: ++sequence, at: new Date().toISOString(),
    invocation: `${instance}:${token.invocation}`, pid, argv: token.argv, cwd: token.cwd,
    startLowerBound: token.lower, startUpperBound: upper,
    data: { writerRuntime: process.version, ...data },
  };
  const encoded = Buffer.from(JSON.stringify(record) + "\n");
  if (bytes + encoded.length > WRITER_LIMIT - FAILURE_RESERVE) {
    integrity(token, "writer-budget-exceeded");
    return;
  }
  try { append(encoded); }
  catch { integrity(token, "sink-io-failed"); }
}

function payload(token: E2ETrace.Token, label: string, value: string | Buffer | null) {
  if (value === null || failed) return null;
  if (typeof value === "string") {
    if (Buffer.byteLength(value) > PAYLOAD_LIMIT) {
      integrity(token, "payload-budget-exceeded");
      return null;
    }
    return { text: value, representation: "returned-string" };
  }
  const content = value;
  if (content.length > PAYLOAD_LIMIT || bytes + content.length > WRITER_LIMIT - FAILURE_RESERVE) {
    integrity(token, "payload-budget-exceeded");
    return null;
  }
  const filename = `${process.pid}-${instance}-${token.invocation}-${label}.bin`;
  try {
    fs.writeFileSync(path.join(root!, filename), content, { flag: "wx", mode: 0o600 });
    bytes += content.length;
    return { path: filename, bytes: content.length };
  } catch {
    // Charge the whole attempted payload conservatively even if its partial
    // write length cannot be recovered, leaving room only for failure metadata.
    bytes += content.length;
    integrity(token, "payload-io-failed");
    return null;
  }
}

function integrity(token: E2ETrace.Token, reason: string): void {
  failed = true;
  try {
    const encoded = Buffer.from("\n" + JSON.stringify({
      schema: 1, event: "integrity-failure", writerPid: process.pid,
      instance, sequence: ++sequence, at: new Date().toISOString(),
      invocation: `${instance}:${token.invocation}`, pid: null, argv: [], cwd: null,
      data: { outcome: reason, writerRuntime: process.version },
    }) + "\n");
    if (bytes + encoded.length <= WRITER_LIMIT) append(encoded);
  } catch { /* Missing/invalid sink remains a measurement failure. */ }
}
