import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import { WindowsFileIoEvidence } from "./WindowsFileIoEvidence";

/**
 * Own optional task-scoped Windows ETW diagnostics around the cold Graph case. Raw machine events stay in private runner temporary storage; only the original task's filtered evidence and explicit diagnostic failures are published. Recorder failures never replace or skip the original scenario.
 *
 * @evidence contracts/common.md#principled-implementation Unique manifests precede recorder admission and correlate two bounded sessions with original task coordinates; native stop acknowledgment precedes decoding and raw-storage reclamation.
 * @evidence contracts/common.md#clear-and-simple-design One test-only owner coordinates the static native fixture and portable event selector; product sessions and source-input release remain with their original owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Default-account native APIs replace no process/global method, escalate no privilege and certify no product retirement. Disabled diagnostics create no storage or child.
 * @evidence contracts/common.md#meaningful-documentation Prose states optional recording, private raw storage and independent failure ownership; members describe task binding and joined recorder shutdown.
 * @evidence contracts/portability.md#os-neutral-implementation Only explicit Windows CI admission invokes the PowerShell/Win32 ETW fixture under the current account; native path joins keep private raw files outside the upload root.
 * @evidence contracts/performance.md#efficient-algorithms Member operations own fixture execution and filtering; the grouping runs no separate algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Recorders and task correlation state are never shared across cold lifetimes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no global state; each opened owner and its workflow fallback control exact named sessions and private storage.
 */
export namespace WindowsColdFileIo {
  /**
   * Original recorder capability, retained until its single joined stop.
   *
   * @evidence contracts/common.md#principled-implementation Binding accepts independently admitted task coordinates while stop shares the original recorder retirement rather than recreating ownership from arbitrary session names.
   * @evidence contracts/common.md#clear-and-simple-design A minimal capability separates one task binding from one recorder retirement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This capability grants no native compiler, product-input or reader-release authority.
   * @evidence contracts/common.md#meaningful-documentation Members state required task provenance and the diagnostic-only stop boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The representation opens no native handle; the original owner invokes its fixture.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The capability type executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type grants no evidence or artifact equivalence.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Acquisition and release belong to open and its retained owner.
   */
  export interface Owner {
    /**
     * Bind the first actual cold-build admission before cancellation.
     *
     * @evidence contracts/common.md#principled-implementation Inputs come from original pre-admission guards and independently observed process births.
     * @evidence contracts/common.md#clear-and-simple-design One binding retains the exact task/scratch/process coordinates for later selection.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A bound token or PID does not certify resource release.
     * @evidence contracts/common.md#meaningful-documentation Prose states actual admission and cancellation ordering.
     * @evidenceExclude contracts/portability.md#os-neutral-implementation The signature carries data without invoking native work.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This capability signature specifies no algorithm.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Binding selects one task rather than a reusable result.
     * @evidence contracts/performance.md#bound-retention-and-release-resources The owner retains one task until stop settles.
     */
    bind(task: Pick<WindowsFileIoEvidence.Task, "token" | "scratch" | "processes">): void;

    /**
     * Stop only the original sessions, filter evidence and release private raw storage after publishing its loss or failure manifest. Repeated calls share the same result, including diagnostic refusal.
     *
     * @evidence contracts/common.md#principled-implementation Actual fixture stop acknowledgment precedes decoding; errors remain diagnostic failures and unknown recording never authorizes product cleanup.
     * @evidence contracts/common.md#clear-and-simple-design One retained promise owns shutdown, filtering and final metadata publication.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts No broad logger shutdown, deleted product inputs or inferred reader absence is permitted.
     * @evidence contracts/common.md#meaningful-documentation Prose states owned-session shutdown, raw-storage release and idempotent refusal.
     * @evidence contracts/portability.md#os-neutral-implementation The fixture compares QUERY's actual output file, ID and GUID with the persisted original StartTraceW receipt, then stops that same supported ID without a name fallback. Invalidated or mismatched identities remain unknown; no undocumented ID-reuse guarantee is claimed.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The signature runs no algorithm; its owner documents bounded trace and delegated filtering work.
     * @evidence contracts/performance.md#reuse-equivalent-work Repeated stop shares exactly this original retirement promise.
     * @evidence contracts/performance.md#bound-retention-and-release-resources Logger closure and published sanitized metadata precede private raw reclamation; failed native stop retains storage and manifests for the workflow's exact-session cleanup.
     */
    stop(): Promise<void>;
  }

  /**
   * Start an explicitly admitted recorder before the original task starts.
   *
   * Two single-provider sessions retain at most 60 MiB file and 4 MiB process raw trace data. Circular overwrite and unmeasured loss remain unknown. The supplied runner is an owned test seam; the default starts the static native fixture under the runner's existing account without a shell. The returned failure property's presence marks refusal, including a JavaScript rejection whose reason is undefined.
   *
   * @evidence contracts/common.md#principled-implementation An exclusive immutable admission plan precedes native work; complete append-only state records cannot replace it. Actual named schemas and Process-before-File admission qualify observation. Native Int64 event IDs are checked against the documented 16-bit domain and normalized to Int32 task keys; malformed identifiers and mismatched task names remain refusals. Original start refusal and secondary publication errors remain separate original objects, while the returned owner retains shutdown capability.
   * @evidence contracts/common.md#clear-and-simple-design One owner retains startup outcome, original task and idempotent stop; native recorder details stay in the fixture and pointer semantics stay in the selector.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit options and an owned runner replace no global process/environment method; logger failures never certify product shutdown or skip original assertions.
   * @evidence contracts/common.md#meaningful-documentation Native prose states start timing, raw budgets, unknown loss and default-account execution; the returned result separately carries owner and startup failure.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths locate the fixture and private runner storage, and argv arrays invoke PowerShell directly. The fixture validates actual provider fields and native DOS-device mappings rather than inferring platform capabilities.
   * @evidence contracts/performance.md#efficient-algorithms Startup delegates schema and process snapshot work. Shutdown streams decoded JSONL into the selector, whose selected output and process/thread histories determine retained memory; raw ETL budgets total 64 MiB, while decoded private text and selected evidence have no independent byte quota.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A unique recorder belongs to one original cold lifetime; no session or previous event population is reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The owner retains two named loggers, an immutable plan, append-only state and private storage until stop settles. Unconfirmed stop or failed evidence/state publication retains raw storage; native closure and completed loss/receipt publication precede raw deletion. Original errors survive later publication/removal failures. State history grows with lifecycle writes without a byte quota, and fixture children close before each operation returns.
   */
  export async function open(options: {
    enabled: boolean;
    traceRoot: string;
    runnerTemp: string;
    fixture: string;
    run?: (mode: "start" | "stop" | "decode", manifest: string) => Promise<void>;
  }): Promise<{ owner?: Owner; failure?: unknown }> {
    if (!options.enabled) return {};
    if (!path.isAbsolute(options.traceRoot) || !path.isAbsolute(options.runnerTemp))
      return { failure: new Error("Windows file diagnostics need absolute owned storage") };
    const nonce = crypto.randomUUID();
    const directory = path.join(options.runnerTemp, `ttsc-graph-etw-${nonce}`);
    const relative = path.relative(options.traceRoot, directory);
    if (relative === "" || (!path.isAbsolute(relative) && !relative.startsWith(".." + path.sep) && relative !== ".."))
      return { failure: new Error("Raw ETW storage must stay outside uploaded observations") };
    fs.mkdirSync(options.traceRoot, { recursive: true });
    fs.mkdirSync(directory);
    const manifest = path.join(options.traceRoot, `graph-fileio-owner-${nonce}.jsonl`);
    const plan = { version: 1, nonce, private: directory, createdAt: new Date().toISOString(), recorderPid: process.pid };
    const record: Record<string, unknown> = { filterEmitted: false, released: false };
    try { fs.writeFileSync(manifest, JSON.stringify(plan) + "\n", { flag: "wx" }); }
    catch (error) {
      // No native command has run, and this exclusive empty directory is the
      // only acquired resource. Never reclaim the product's retained inputs.
      try { fs.rmdirSync(directory); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], "Recorder manifest admission failed"); }
      throw error;
    }
    const run = options.run ?? ((mode, owned) => invoke(options.fixture, mode, owned));
    const startupFailures: unknown[] = [];
    try { await run("start", manifest); }
    catch (error) { startupFailures.push(error); record.startFailure = describe(error); }
    try { journal(manifest, record); } catch (error) { startupFailures.push(error); }
    let task: Pick<WindowsFileIoEvidence.Task, "token" | "scratch" | "processes"> | undefined;
    let stopping: Promise<void> | undefined;
    const owner: Owner = {
      bind: (next) => {
        if (task !== undefined || stopping !== undefined) throw new Error("Original recorder task binding is immutable");
        task = { ...next, processes: next.processes.map((entry) => ({ ...entry })) };
      },
      stop: () => stopping ??= (async () => {
        const failures: unknown[] = [];
        let joined = false, receipts: unknown;
        try { await run("stop", manifest); } catch (error) { failures.push(error); }
        try {
          receipts = read(path.join(directory, "stopped.json"));
          joined = retirement(receipts);
          if (!joined) failures.push(new Error("Original recorder stop was not confirmed"));
        } catch (error) { failures.push(error); }
        let evidence: unknown;
        let loss: WindowsFileIoEvidence.Task["loss"] = { eventsLost: null, possibleWrap: true, decodingFailed: true };
        if (joined && startupFailures.length === 0) {
          try {
            await run("decode", manifest);
            const decoded = read(path.join(directory, "decoded.json")) as typeof loss & { failures: string[] };
            loss = decoded;
            if (decoded.failures.length) failures.push(new Error(decoded.failures.join("\n")));
            if (task === undefined) throw new Error("Original cold task admission was not observed");
            const started = read(path.join(directory, "started.json")) as { devices: WindowsFileIoEvidence.Task["devices"] };
            const before = read(path.join(directory, "before.json")) as WindowsFileIoEvidence.Task["before"];
            evidence = WindowsFileIoEvidence.select(rows(path.join(directory, "events.jsonl")), { ...task, devices: started.devices, before, loss });
          } catch (error) { loss.decodingFailed = true; failures.push(error); }
        }
        const output = path.join(options.traceRoot, `graph-fileio-evidence-${nonce}.jsonl`);
        let capability: unknown = null;
        try { capability = read(path.join(directory, "capability.json")); } catch { /* A failed preflight has no capability receipt. */ }
        let schemas: unknown = null;
        try { schemas = read(path.join(directory, "schema.json")); } catch { /* Unsupported preflight has no validated schema receipt. */ }
        let admission: unknown = null;
        try { admission = read(path.join(directory, "admission.json")); } catch { /* Failed fixture admission can lack native admission metadata. */ }
        try {
          fs.writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), nonce, joinedRecorder: joined, originalTask: task ?? null,
            capability, schemas, admission, retirement: receipts ?? null, loss, evidence: evidence ?? null, failures: [...startupFailures, ...failures].map(describe),
          }) + "\n", { flag: "wx" });
          record.filterEmitted = true;
        } catch (error) { failures.push(error); }
        record.stopJoined = joined;
        record.loss = loss;
        record.retirement = receipts ?? null;
        record.failures = [...startupFailures, ...failures].map(describe);
        let recorded = false;
        try { journal(manifest, record); recorded = true; } catch (error) { failures.push(error); }
        if (joined && record.filterEmitted === true && recorded) {
          // These are joined recorder files, never the original source task's
          // unknown scratch or cache. Raw machine rows are never uploaded.
          try { fs.rmSync(directory, { recursive: true, force: true }); record.released = true; }
          catch (error) { failures.push(error); }
          record.failures = [...startupFailures, ...failures].map(describe);
          try { journal(manifest, record); } catch (error) { failures.push(error); }
        }
        if (failures.length) throw new AggregateError(failures, "Windows file diagnostics failed");
      })(),
    };
    return { owner, ...(startupFailures.length === 0 ? {} : { failure: startupFailures.length === 1 ? startupFailures[0] : new AggregateError(startupFailures, "Windows recorder startup failed") }) };
  }

  /**
   * Stop exact manifested sessions after interrupted test ownership, publish incomplete recording metadata and release only joined private raw storage.
   *
   * @evidence contracts/common.md#principled-implementation Immutable exclusively created plans select exact session names and runner-temporary paths. Complete state records may carry original native acknowledgments; interrupted records provide no proof. Actual sibling stop or never-attempted admission receipts qualify closure before raw reclamation.
   * @evidence contracts/common.md#clear-and-simple-design One workflow fallback visits original unreleased manifests and invokes their owned stop operation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No broad logger enumeration/termination, elevated account or original product-input deletion occurs.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies interruption recovery, incomplete evidence publication and joined raw release; optional runner supplies a portable owned-operation test seam.
   * @evidence contracts/portability.md#os-neutral-implementation Actual native fixture queries validate current ownership before logger stop; paths use Node native APIs.
   * @evidence contracts/performance.md#efficient-algorithms One directory scan selects manifests; each outstanding owner runs one native stop and emits one failure or completion record.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Released manifests skip native work; every unreleased owner retains its actual independent lifetime.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The workflow owns this final attempt after the E2E process stops; incomplete metadata precedes joined raw deletion, unresolved recorder/storage remains reported, and source-input authority is never acquired.
   */
  export async function cleanup(traceRoot: string, fixture: string, runnerTemp: string,
    run: (mode: "stop", manifest: string) => Promise<void> = (mode, manifest) => invoke(fixture, mode, manifest),
  ): Promise<void> {
    if (!path.isAbsolute(traceRoot) || !path.isAbsolute(runnerTemp)) throw new Error("Interrupted recorder cleanup needs absolute owned storage");
    const failures: unknown[] = [];
    for (const entry of fs.readdirSync(traceRoot)) {
      if (!/^graph-fileio-owner-[0-9a-f-]{36}\.jsonl$/.test(entry)) continue;
      const manifest = path.join(traceRoot, entry);
      try {
        const owner = read(manifest) as Record<string, unknown>;
        if (owner.version !== 1 || typeof owner.nonce !== "string" || !/^[0-9a-f-]{36}$/.test(owner.nonce) ||
            entry !== `graph-fileio-owner-${owner.nonce}.jsonl` || typeof owner.private !== "string" ||
            path.resolve(owner.private) !== path.resolve(runnerTemp, `ttsc-graph-etw-${owner.nonce}`))
          throw new Error("Interrupted recorder storage identity does not match this run");
        const directory = path.resolve(owner.private);
        const state = completedState(manifest);
        const record = state.last ?? {};
        if (record.released === true) continue;
        const originalFailures: unknown[] = state.failure === undefined ? [] : [state.failure];
        let joined = false, receipts: unknown = record.retirement;
        try {
          if (record.stopJoined !== true || !retirement(receipts)) await run("stop", manifest);
        } catch (error) { originalFailures.push(error); }
        try {
          if (record.stopJoined !== true || !retirement(receipts)) receipts = read(path.join(directory, "stopped.json"));
          joined = retirement(receipts);
          if (!joined) throw new Error("Interrupted original recorder stop remains unconfirmed");
        } catch (error) { originalFailures.push(error); }
        let emitted = false;
        try {
          publish(path.join(traceRoot, `graph-fileio-interrupted-${owner.nonce}.jsonl`), {
            at: new Date().toISOString(), nonce: owner.nonce, joinedRecorder: joined, interruptedState: state.interrupted,
            retirement: receipts ?? null, loss: { eventsLost: null, possibleWrap: true, decodingFailed: true },
            evidence: null, readerAbsence: "not-established",
            failures: originalFailures.length ? originalFailures.map(describe) : ["E2E recorder ownership interrupted before final reclamation"],
          });
          emitted = true;
        } catch (error) { originalFailures.push(error); }
        record.workflowStopAttempted = record.stopJoined !== true;
        record.stopJoined = joined;
        record.retirement = receipts ?? null;
        record.failures = originalFailures.map(describe);
        let recorded = false;
        try { journal(manifest, record); recorded = true; } catch (error) { originalFailures.push(error); }
        if (joined && emitted && recorded) {
          try { fs.rmSync(directory, { recursive: true, force: true }); record.released = true; }
          catch (error) { originalFailures.push(error); }
          record.failures = originalFailures.map(describe);
          try { journal(manifest, record); } catch (error) { originalFailures.push(error); }
        }
        if (originalFailures.length) throw new AggregateError(originalFailures, "Original interrupted recorder cleanup failed");
      } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "Interrupted Windows recorder cleanup failed");
  }
}

/** Invoke the installed native fixture directly and join its pipes and exit. */
function invoke(fixture: string, mode: string, manifest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", fixture, "-Mode", mode, "-Manifest", manifest], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "", error: unknown;
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", (failure) => { error = failure; });
    child.once("close", (code, signal) => {
      if (error !== undefined) reject(error);
      else if (code === 0 && signal === null) resolve();
      else reject(new Error(`Windows diagnostic fixture ${mode} failed (${code}, ${signal}): ${output}`));
    });
  });
}

/** Read owned post-stop JSON metadata; decode failure remains a diagnostic failure. */
function read(file: string): unknown { return JSON.parse(fs.readFileSync(file, "utf8")); }

/** Publish filtered diagnostic metadata without modifying the admission plan. */
function publish(file: string, value: unknown): void { fs.writeFileSync(file, JSON.stringify(value) + "\n"); }

/** Keep the exclusive admission plan immutable while appending state records. */
function journal(manifest: string, value: unknown): void {
  fs.appendFileSync(statePath(manifest), "\n" + JSON.stringify(value) + "\n");
}

/** State loss cannot remove the admission plan's exact fallback coordinates. */
function statePath(manifest: string): string {
  return path.join(path.dirname(manifest), path.basename(manifest).replace("graph-fileio-owner-", "graph-fileio-state-"));
}

/** Interrupted prefixes are observations, never proof of a completed state. */
function completedState(manifest: string): { last?: Record<string, unknown>; interrupted: boolean; failure?: unknown } {
  let text: string;
  try { text = fs.readFileSync(statePath(manifest), "utf8"); }
  catch (failure) { return { interrupted: true, failure }; }
  const lines = text.split("\n"), partial = lines.pop()!;
  let last: Record<string, unknown> | undefined, interrupted = partial.trim() !== "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (value === null || typeof value !== "object" || Array.isArray(value)) { interrupted = true; continue; }
      last = value as Record<string, unknown>;
    } catch { interrupted = true; }
  }
  return { last, interrupted };
}

/** Only original stop acknowledgments or no-attempt admissions qualify closure. */
function retirement(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  const sessions = (value as { sessions?: unknown }).sessions;
  return Array.isArray(sessions) && sessions.length === 2 && sessions.every((entry) =>
    entry !== null && typeof entry === "object" && ((entry.state === "not-admitted" && entry.attempted === false) || (entry.state === "stopped" && entry.code === 0)),
  );
}

/** Refusal objects stay in the ledger even when their text cannot be inspected. */
function describe(error: unknown): string {
  try {
    if (error instanceof AggregateError) return `${error.name}: ${error.message} [${error.errors.map(describe).join("; ")}]`;
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } catch { return "Diagnostic refusal text unavailable; original object retained"; }
}

/** Stream private decoded rows after recorder close, retaining one read buffer. */
function* rows(file: string): Generator<WindowsFileIoEvidence.Event> {
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.alloc(65536);
  const decoder = new StringDecoder("utf8");
  let pending = "";
  try {
    while (true) {
      const count = fs.readSync(descriptor, buffer);
      if (count === 0) break;
      pending += decoder.write(buffer.subarray(0, count));
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline).replace(/\r$/, "");
        pending = pending.slice(newline + 1);
        if (line) yield JSON.parse(line) as WindowsFileIoEvidence.Event;
      }
    }
    pending += decoder.end();
    if (pending.trim()) yield JSON.parse(pending) as WindowsFileIoEvidence.Event;
  } finally { fs.closeSync(descriptor); }
}
