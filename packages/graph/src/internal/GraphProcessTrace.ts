import { spawn as nativeSpawn, spawnSync as nativeSpawnSync, type SpawnOptions, type SpawnSyncOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { errorMonitor } from "node:events";
import fs from "node:fs";
import path from "node:path";

/**
 * Private process observers; package entrypoints do not export this namespace.
 * The aliases retain Node's overloads while their adapters pass arguments intact.
 *
 * @internal
 *
 * @evidence contracts/common.md#principled-implementation The two aliases retain the native process primitive signatures; their adapters return the actual child or synchronous result.
 * @evidence contracts/common.md#clear-and-simple-design One internal namespace groups the two maintained process boundaries without adding a package entrypoint export.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No native export is replaced and no product flag, protocol field or fixture-specific behavior is introduced.
 * @evidence contracts/common.md#meaningful-documentation Native prose states private visibility and preservation of Node's overload signatures.
 * @evidence contracts/portability.md#os-neutral-implementation The aliases preserve Node's native executable, argv and option types rather than defining an OS-specific process representation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups adapters and does not independently select an algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace introduces no completed computation cache or shared process holder.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Process and observation lifetime belong to the adapters and their existing callers, not this alias namespace.
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
 * @evidence contracts/common.md#principled-implementation A process-local nonce and increasing ordinal identify actual calls independently of child PID reuse; events retain observed fields rather than inferred starts.
 * @evidence contracts/common.md#clear-and-simple-design One optional closure owns event correlation and the synchronous append sink; callers own all process behavior.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The private approved observer uses no fixture oracle, product flag, foreign mutation or test-helper dependency.
 * @evidence contracts/common.md#meaningful-documentation Native prose states root ownership, missing-data behavior and unchanged product IO.
 * @evidence contracts/portability.md#os-neutral-implementation Node native absolute-path and append operations retain the coordinator's path spelling; process.pid identifies this actual writer.
 * @evidence contracts/performance.md#efficient-algorithms Each event serializes its supplied fields once and appends their UTF-8 bytes; tracing adds disclosed synchronous IO rather than claiming a speedup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Actual calls and writes are effectful and are never deduplicated; a single nonce only identifies this module instance.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Scalar counters and one nonce persist per module instance; writes close per append and output is capped at 256MiB plus one overwritten 4096-character integrity marker. The coordinator retains files until writers join.
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
 * @evidence contracts/common.md#principled-implementation The unchanged native spawn executes once; supported events provide actual PID, exit and close observations under one invocation.
 * @evidence contracts/common.md#clear-and-simple-design The adapter reports lifecycle only; existing owners retain streams, parsing, shutdown, references and error handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Original arguments, returned child and synchronous error are preserved without foreign patching or synthetic children.
 * @evidence contracts/common.md#meaningful-documentation Prose distinguishes call bounds, normal error behavior and descendant lifetime limitations.
 * @evidence contracts/portability.md#os-neutral-implementation Executable, argv and native options pass unchanged to Node; cwd records supplied or inherited intent without guessed native resolution.
 * @evidence contracts/performance.md#efficient-algorithms Disabled observation directly delegates; enabled calls serialize argv and a fixed lifecycle event population.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each spawn is an effectful native call; the observer cannot choose whether a caller reuses an existing peer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Once listeners retain correlation until their event or child collection; no reference, timer, kill or independent wait is introduced. Child release stays with its original owner.
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
 * @evidence contracts/common.md#principled-implementation The actual spawnSync return supplies PID, status, signal and error; unsuccessful pre-start attempts remain distinct from observed child starts.
 * @evidence contracts/common.md#clear-and-simple-design One adapter surrounds the native call; downstream capture, status mapping and disposal remain in their existing owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native arguments and the identical result or thrown error pass through, without changing protocol bytes or substituting expected counts.
 * @evidence contracts/common.md#meaningful-documentation Prose explains actual PID and timing limits and preservation of native options.
 * @evidence contracts/portability.md#os-neutral-implementation Original executable, argument vector and process options reach Node unchanged; inherited cwd intent is recorded separately from an explicit path.
 * @evidence contracts/performance.md#efficient-algorithms Observation adds argv serialization and two bounded event writes per actual call; captured product output is not copied into this trace.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each synchronous process call is effectful and observed separately.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Only one call-local correlation is retained until native return; append handles close per write and existing callers still release captures.
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
