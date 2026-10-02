import { spawn as nativeSpawn, spawnSync as nativeSpawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { errorMonitor } from "node:events";
import fs from "node:fs";
import path from "node:path";

/**
 * Private process observers; package entrypoints do not export this namespace.
 * The aliases retain Node's overloads while their adapters pass arguments intact.
 * Native executable, argv and option types stay with Node. This grouping adds
 * no product flag, protocol field, cache, process holder or algorithm; those
 * responsibilities remain with the adapters and their existing callers.
 *
 * @internal
 */
export namespace GraphProcessTrace {
  export const spawn = observeSpawn as typeof nativeSpawn;
  export const spawnSync = observeSpawnSync as typeof nativeSpawnSync;
}

/**
 * Correlate one actual call in the coordinator's absolute scratch directory.
 * Failed writes leave bounded integrity evidence where possible; an unwritable
 * sink remains missing measurement data. Neither failure changes product IO.
 *
 * A process-local nonce and increasing ordinal distinguish calls from child
 * PID reuse. The optional closure owns correlation and the append sink only;
 * callers own process behavior. Node's absolute-path and append operations use
 * the coordinator's native path spelling and process.pid identifies the writer.
 * No fixture oracle, foreign mutation or test-helper dependency is involved.
 *
 * Each event serializes its observed fields once, so temporary text follows
 * event size. Synchronous IO is measurement overhead, not a claimed speedup.
 * Effectful calls and writes are never deduplicated. Scalar counters and one
 * nonce persist per module instance; each append closes its handle. Events are
 * capped at64MiB and writer output at256MiB, plus one overwritten bounded
 * integrity marker. The coordinator retains these files until writers join.
 */
function begin() {
  const root = process.env.TTSC_E2E_TRACE;
  if (!root || !path.isAbsolute(root)) return undefined;
  try { instance ??= randomUUID(); } catch { return undefined; }
  const writerInstance = instance;
  const invocation = `${writerInstance}:${++ordinal}`;
  const file = path.join(root, `${process.pid}-${writerInstance}.jsonl`);
  return (event: string, fields: Record<string, unknown>): void => {
    try {
      const line = JSON.stringify({ ...fields, schema: 1, event,
        writerPid: process.pid, instance: writerInstance, sequence: ++sequence,
        at: new Date().toISOString(), invocation }) + "\n";
      const bytes = Buffer.byteLength(line);
      if (bytes > EVENT_LIMIT || written + bytes > WRITER_LIMIT)
        throw new Error("trace writer byte budget exceeded");
      fs.appendFileSync(file, line, { encoding: "utf8", mode: 0o600 });
      written += bytes;
    } catch {
      try { fs.writeFileSync(`${file}.integrity`, "trace serialization, append or byte budget failed", { mode: 0o600 }); } catch { /* Missing trace remains an integrity failure. */ }
    }
  };
}

/**
 * Observe the supported spawn, exit and close events on the original child.
 * errorMonitor observes errors without becoming a normal error handler. Call
 * bounds are not exact OS creation times; close does not join descendants.
 *
 * Native spawn executes once with unchanged executable, argv and options and
 * returns the original child or throws the same synchronous error. Events
 * provide actual PID and lifecycle observations under one invocation; cwd
 * records explicit or inherited intent without guessing native resolution.
 * Streams, parsing, shutdown, references and normal errors stay caller-owned.
 *
 * Disabled observation delegates directly; enabled calls serialize argv and a
 * fixed event population. Effectful starts are not reusable results. Once
 * listeners retain correlation until their event or child collection; no timer,
 * reference change, kill or independent wait is added. Existing owners release
 * the child, and no foreign process export is patched.
 */
function observeSpawn(...args: Parameters<typeof nativeSpawn>) {
  const trace = begin();
  if (!trace) return Reflect.apply(nativeSpawn, undefined, args);
  const options = (Array.isArray(args[1]) ? args[2] : args[1]) as SpawnOptions | undefined;
  const selected = { argv: [args[0], ...(Array.isArray(args[1]) ? args[1] : [])], cwd: options?.cwd === undefined ? null : String(options.cwd), data: { primitive: "spawn", cwdInherited: options?.cwd === undefined } };
  const startLowerBound = new Date().toISOString();
  trace("process-attempt", { ...selected, pid: null, startLowerBound });
  let child: ReturnType<typeof nativeSpawn>;
  try { child = Reflect.apply(nativeSpawn, undefined, args); }
  catch (error) {
    trace("process-result", { pid: null, started: false, exitObserved: false, startLowerBound, startUpperBound: new Date().toISOString(), data: { outcome: "synchronous-spawn-error", error } });
    throw error;
  }
  const startUpperBound = new Date().toISOString();
  let started = false;
  let exitObserved = false;
  child.once("spawn", () => { started = true; trace("process-start", { pid: child.pid ?? null, started, startLowerBound, startUpperBound }); });
  child.once(errorMonitor, (error: Error) => trace("process-error", { pid: child.pid ?? null, started, exitObserved, error: error.message, data: { code: (error as NodeJS.ErrnoException).code } }));
  child.once("exit", (status, signal) => { exitObserved = true; trace("process-exit", { pid: child.pid ?? null, started, exitObserved, status, signal }); });
  child.once("close", (status, signal) => trace("process-close", { pid: child.pid ?? null, started, exitObserved, status, signal }));
  return child;
}

/**
 * Observe the original synchronous result without replacing file descriptors,
 * encoding, buffers, shell options or errors. A positive returned PID records
 * a started child; call bounds do not invent its exact creation timestamp.
 *
 * Actual returned PID/status/signal/error distinguish a child from a failed
 * pre-start attempt. Executable, argv, native options and the identical result
 * or thrown error pass through unchanged. Explicit cwd and inherited intent are
 * distinct observations, not resolved executable identity. Downstream capture,
 * status mapping, protocol bytes and disposal remain in their existing owners.
 *
 * Observation adds argv serialization and two bounded event writes per actual
 * effectful call; captured output is not copied or reused as expected counts.
 * One correlation remains until native return, append handles close per write
 * and original callers still release their captures.
 */
function observeSpawnSync(...args: Parameters<typeof nativeSpawnSync>) {
  const trace = begin();
  if (!trace) return Reflect.apply(nativeSpawnSync, undefined, args);
  const options = (Array.isArray(args[1]) ? args[2] : args[1]) as SpawnSyncOptions | undefined;
  const selected = { argv: [args[0], ...(Array.isArray(args[1]) ? args[1] : [])], cwd: options?.cwd === undefined ? null : String(options.cwd), data: { primitive: "spawnSync", cwdInherited: options?.cwd === undefined } };
  const startLowerBound = new Date().toISOString();
  trace("process-attempt", { ...selected, pid: null, startLowerBound });
  let result: ReturnType<typeof nativeSpawnSync>;
  try { result = Reflect.apply(nativeSpawnSync, undefined, args); }
  catch (error) {
    trace("process-result", { pid: null, started: false, exitObserved: false, startLowerBound, startUpperBound: new Date().toISOString(), data: { outcome: "synchronous-spawn-error", error } });
    throw error;
  }
  trace("process-result", { pid: result.pid || null, started: result.pid > 0,
    exitObserved: result.status !== null || result.signal !== null,
    status: result.status, signal: result.signal, error: result.error?.message,
    startLowerBound, startUpperBound: new Date().toISOString() });
  return result;
}

let instance: string | undefined;
let ordinal = 0;
let sequence = 0;
let written = 0;
const EVENT_LIMIT = 64 * 1024 * 1024;
const WRITER_LIMIT = 256 * 1024 * 1024;
