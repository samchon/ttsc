"use strict";
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { errorMonitor } = require("node:events");
const { promisify } = require("node:util");

/**
 * Observes test-owned child primitives without replacing Node's exports.
 * Calls retain their original arguments, returned child/results, IO and errors.
 * Disabled tracing performs no file IO; enabled writes belong to the external
 * coordinator root and failures never replace the observed operation's result.
 *
 * @evidence contracts/common.md#principled-implementation Supported original child primitives execute once; opt-in side-channel events never manufacture process success or alter captured output.
 * @evidence contracts/common.md#clear-and-simple-design One test-only runtime owns the shared event sink and adapters, including embedded fixture consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No foreign export is patched and missing PID/events are not replaced with expected process counts.
 * @evidence contracts/common.md#meaningful-documentation Documents original result/error preservation, IO opt-in and the coordinator-owned output lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation Node native child/path operations retain caller shell, environment and platform options; PID evidence does not certify arbitrary descendants.
 * @evidence contracts/performance.md#efficient-algorithms Each event serializes its actual fields once; synchronous append IO and raw-byte capture are explicit measurement overhead.
 * @evidence contracts/performance.md#reuse-equivalent-work One process/root state shares its nonce and sequence; process outcomes and captured values are never reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each append/capture is synchronously closed; writer output is capped at256MiB and payloads at64MiB, with coordinator-owned retention after joins.
 */
const E2eProcessTraceRuntime = {
  spawn(...args) { return observeChild("spawn", args); },
  fork(...args) { return observeChild("fork", args); },
  execFile(...args) { return observeChild("execFile", args); },
  exec(...args) { return observeChild("exec", args); },
  spawnSync(...args) { return observeSync(args); },
  execFileSync(file, args, options) {
    if (!process.env.TTSC_E2E_TRACE) return Reflect.apply(cp.execFileSync, cp, arguments);
    // These test callers provide the ordinary file/argv/options form.
    if (!Array.isArray(args)) { options = args; args = []; }
    options = options ?? {};
    const result = observeSync([file, args, options]);
    if (!options.stdio && result.stderr) process.stderr.write(result.stderr);
    throwExecFailure(result, [options.argv0 || file, ...args].join(" "));
    return result.stdout;
  },
  execSync(command, options) {
    if (!process.env.TTSC_E2E_TRACE) return Reflect.apply(cp.execSync, cp, arguments);
    const selected = { ...options, shell: typeof options?.shell === "string" ? options.shell : true };
    const result = observeSync([command, selected]);
    if (!selected.stdio && result.stderr) process.stderr.write(result.stderr);
    throwExecFailure(result, command);
    return result.stdout;
  },
  begin,
  record,
  capture,
};
module.exports = E2eProcessTraceRuntime;

for (const kind of ["exec", "execFile"]) {
  Object.defineProperty(E2eProcessTraceRuntime[kind], promisify.custom, {
    value: function (...args) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      promise.child = E2eProcessTraceRuntime[kind](...args, (error, stdout, stderr) => {
        if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); }
        else resolve({ stdout, stderr });
      });
      return promise;
    },
  });
}

let state;
const WRITER_LIMIT = 256 * 1024 * 1024;
const PAYLOAD_LIMIT = 64 * 1024 * 1024;

/** Lazily initializes only the coordinator-selected absolute trace root. */
function sink() {
  const root = process.env.TTSC_E2E_TRACE;
  if (!root || !path.isAbsolute(root)) return undefined;
  if (state?.root === root) return state;
  try {
    if (!fs.statSync(root).isDirectory()) return undefined;
    const instance = crypto.randomUUID();
    state = { root, instance, sequence: 0, ordinal: 0, bytes: 0,
      file: path.join(root, `${process.pid}-${instance}.jsonl`) };
    return state;
  } catch { return undefined; }
}

/** Identifies an actual call independently of child PID reuse. */
function begin() {
  const owner = sink();
  return owner ? `${owner.instance}:${++owner.ordinal}` : undefined;
}

/** Appends one bounded event; failures are retained without protocol output. */
function record(event, invocation, fields = {}) {
  const owner = sink();
  if (!owner || !invocation) return;
  try {
    if (typeof invocation !== "string" || !invocation.startsWith(owner.instance + ":"))
      throw new Error("trace invocation belongs to another writer instance");
    const bytes = Buffer.from(JSON.stringify({ ...fields, schema: 1, event,
      writerPid: process.pid, instance: owner.instance,
      sequence: ++owner.sequence, at: new Date().toISOString(), invocation }) + "\n");
    if (owner.bytes + bytes.length > WRITER_LIMIT) throw new Error("trace writer budget exceeded");
    fs.appendFileSync(owner.file, bytes);
    owner.bytes += bytes.length;
  } catch (error) { integrity(owner, error); }
}

/** Retains exact already-observed bytes, never a reconstructed reply. */
function capture(invocation, label, bytes) {
  const owner = sink();
  if (!owner || !invocation) return undefined;
  let observedBytes;
  try { observedBytes = Buffer.byteLength(bytes); }
  catch (error) { integrity(owner, error); return { capture: "IO-failed" }; }
  if (observedBytes > PAYLOAD_LIMIT || owner.bytes + observedBytes > WRITER_LIMIT) {
    integrity(owner, new Error("trace payload budget exceeded"));
    return { capture: "too-large", observedBytes };
  }
  const ordinal = invocation.slice(invocation.lastIndexOf(":") + 1);
  if (!invocation.startsWith(owner.instance + ":") || !/^\d+$/.test(ordinal) || !/^[a-z0-9-]+$/i.test(label)) {
    integrity(owner, new Error("invalid trace payload identity"));
    return { capture: "IO-failed", observedBytes };
  }
  const relativePath = `${process.pid}-${owner.instance}-${ordinal}-${label}.bin`;
  try {
    fs.writeFileSync(path.join(owner.root, relativePath), bytes, { flag: "wx" });
    owner.bytes += observedBytes;
    return { capture: "complete", observedBytes, relativePath };
  } catch (error) {
    integrity(owner, error);
    return { capture: "IO-failed", observedBytes };
  }
}

/** Leaves bounded integrity evidence; an unwritable sink remains missing data. */
function integrity(owner, error) {
  try {
    fs.writeFileSync(`${owner.file}.integrity`, String(error?.message ?? error).slice(0, 4096));
  } catch {}
}

/** Describes selected primitive arguments without resolving a new executable. */
function selection(kind, args) {
  const options = (Array.isArray(args[1]) ? args[2] : args[1]) ?? {};
  return { argv: [String(args[0]), ...(Array.isArray(args[1]) ? args[1] : [])],
    cwd: options.cwd === undefined ? null : String(options.cwd),
    data: { primitive: kind, cwdInherited: options.cwd === undefined,
      argvObservation: "requested-call-arguments", shell: options.shell ?? false } };
}

/** Preserves synchronous results; PID is observed only from the actual return. */
function observeSync(args) {
  if (!process.env.TTSC_E2E_TRACE) return Reflect.apply(cp.spawnSync, cp, args);
  const invocation = begin();
  const startLowerBound = new Date().toISOString();
  const selected = invocation ? selection("spawnSync", args) : undefined;
  record("process-attempt", invocation, { ...selected, pid: null, startLowerBound });
  let result;
  try { result = Reflect.apply(cp.spawnSync, cp, args); }
  catch (error) {
    record("process-result", invocation, { ...selected, pid: null, started: false,
      startLowerBound, startUpperBound: new Date().toISOString(), error: String(error) });
    throw error;
  }
  record("process-result", invocation, { ...selected, pid: result.pid || null,
    started: result.pid > 0, exitObserved: result.status !== null || result.signal !== null,
    startLowerBound, startUpperBound: new Date().toISOString(),
    status: result.status, signal: result.signal, error: result.error?.message });
  return result;
}

/** Adds supported listeners to the same returned child, without changing IO. */
function observeChild(kind, args) {
  if (!process.env.TTSC_E2E_TRACE) return Reflect.apply(cp[kind], cp, args);
  const invocation = begin();
  const startLowerBound = new Date().toISOString();
  const selected = invocation ? selection(kind, args) : undefined;
  record("process-attempt", invocation, { ...selected, pid: null, startLowerBound });
  let child;
  try { child = Reflect.apply(cp[kind], cp, args); }
  catch (error) {
    record("process-result", invocation, { ...selected, pid: null, started: false,
      startLowerBound, startUpperBound: new Date().toISOString(), error: String(error) });
    throw error;
  }
  if (invocation) {
    child.once("spawn", () => record("process-start", invocation, { ...selected,
      argv: child.spawnargs, data: { ...selected.data, argvObservation: "actual-child-spawnargs" },
      pid: child.pid, startLowerBound, startUpperBound: new Date().toISOString() }));
    child.once("exit", (status, signal) => record("process-exit", invocation, {
      pid: child.pid ?? null, status, signal }));
    child.once("close", (status, signal) => record("process-close", invocation, {
      pid: child.pid ?? null, status, signal }));
    child.once(errorMonitor, (error) => record("process-result", invocation, {
      pid: child.pid ?? null, error: String(error), started: child.pid > 0 }));
    // errorMonitor observes without suppressing an original unhandled error.
  }
  return child;
}

/** Mirrors the exec adapters' actual result-enriched throw contract. */
function throwExecFailure(result, command) {
  if (result.error) throw Object.assign(result.error, result);
  if (result.status !== 0) {
    const message = `Command failed: ${command}${result.stderr?.length ? `\n${result.stderr.toString()}` : ""}`;
    throw Object.assign(new Error(message), result);
  }
}
