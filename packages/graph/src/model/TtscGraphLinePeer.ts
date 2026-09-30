import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";

const TERMINATION_GRACE_MS = 1_000;

/**
 * Native line transport shared by graph and lint resident owners.
 *
 * @evidence contracts/common.md#principled-implementation Node stdout line framing and explicit process events preserve the native protocols while request correlation remains with their state owners.
 * @evidence contracts/common.md#clear-and-simple-design A connection exposes only liveness, diagnostics, writes and retirement; two existing shutdown policies serve graph cancellation and daemon fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The default adapter invokes the actual binary and argv without a shell, synthetic responses or replaced foreign methods.
 * @evidence contracts/common.md#meaningful-documentation Connection comments state line/event ownership, bounded diagnostic capture and the difference between reader retirement and process termination.
 * @evidenceExclude contracts/performance.md#efficient-algorithms open owns process and line setup; the namespace groups its connection protocol.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resident state owners decide peer reuse; this namespace adds no result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources open and its returned close implementation own actual child/reader acquisition and retirement.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Events, Connection and open document the native representation and operations rather than the namespace grouping them.
 */
export namespace TtscGraphLinePeer {
  /**
   * Events produced by a native child, addressed by its connection owner.
   *
   * @evidence contracts/common.md#principled-implementation Complete stdout lines, startup errors and nullable code/signal exit coordinates represent distinct Node process events.
   * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
   * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
   */
  export interface Events {
    /**
     * One complete stdout line.
     *
     * @evidence contracts/common.md#principled-implementation The callback receives a complete UTF-8 stdout line without imposing graph syntax or response correlation.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    line(line: string): void;
    /**
     * Child startup or transport failure.
     *
     * @evidence contracts/common.md#principled-implementation The callback preserves the actual child Error as a failure event rather than a synthetic success frame.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    error(error: Error): void;
    /**
     * Actual process exit; a retired reader cannot publish later lines.
     *
     * @evidence contracts/common.md#principled-implementation Nullable numeric code and Node signal name preserve whether a native process exited normally or by signal.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    exit(code: number | null, signal: NodeJS.Signals | null): void;
  }

  /**
   * Owned native handle used by resident state machines.
   *
   * @evidence contracts/common.md#principled-implementation A connection groups actual process liveness, bounded diagnostics, writes and reader/process retirement under one owned identity.
   * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
   * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
   * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
   */
  export interface Connection {
    /** Up to the last 64 KiB of diagnostics when capture is selected. */
    readonly stderr: string;
    /**
     * Whether the underlying child still has no exit status.
     *
     * @evidence contracts/common.md#principled-implementation Liveness reflects the Node child exitCode/signalCode pair; a sent kill signal alone is not a completed exit.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    alive(): boolean;
    /**
     * Write one complete request; errors belong to the request owner.
     *
     * @evidence contracts/common.md#principled-implementation The actual stdin callback transfers write failure to its request owner without manufacturing a response.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    write(line: string, done: (error?: Error | null) => void): void;
    /**
     * Detach the reader and optionally terminate the owned process.
     *
     * @evidence contracts/common.md#principled-implementation Reader retirement is distinct from process termination; repeated retirement cannot send a second termination request.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    close(terminate: boolean): void;
  }

  /**
   * Open the actual Node child and attach its reader and diagnostic drain.
   *
   * Graph cancellation destroys stdin and allows a finite kill grace; daemon
   * fallback ends stdin and kills immediately. Both retain the existing argv
   * and native process semantics.
   *
   * @evidence contracts/common.md#principled-implementation Node spawn and readline map executable, argv and complete lines to the declared transport operations without interpreting graph facts.
   * @evidence contracts/common.md#clear-and-simple-design One adapter implements actual process I/O; resident state owners choose their existing diagnostic and shutdown policies.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Real process APIs retain their defaults and explicit argv; no test-only executable or response path is supplied.
   * @evidence contracts/common.md#meaningful-documentation Prose explains the existing two shutdown policies and connection comments describe bounded stderr and retirement.
   * @evidence contracts/performance.md#efficient-algorithms One spawn/reader setup is constant-count; writes and line decoding process frame bytes once, while captured diagnostics retain only a 64 KiB tail and draining avoids pipe backpressure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This effectful opener creates one native peer; resident state determines when that peer remains reusable or must be replaced.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned close owns one reader and child, detaches once and terminates at most once; graph grace escalation has one unreferenced finite timer cleared on exit, while stream/event references remain attached until native exit.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn receives an executable and argv vector directly with windowsHide; Node stream/process APIs own native signals and optional cwd, without a shell or manual path normalization.
   */
  export function open(
    binary: string,
    args: string[],
    events: Events,
    options: { cwd?: string; stderr: "capture" | "drain"; termination: "grace" | "end" },
  ): Connection {
    const child = spawn(binary, args, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    const lines = readline.createInterface({ input: child.stdout });
    let stderr = "";
    let readerClosed = false;
    let terminated = false;
    if (options.stderr === "capture") {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-64 * 1024); });
    } else child.stderr.resume();
    lines.on("line", events.line);
    child.on("error", events.error);
    child.on("exit", events.exit);
    return {
      get stderr() { return stderr; },
      alive: () => child.exitCode === null && child.signalCode === null,
      write: (line, done) => { child.stdin.write(line, done); },
      close: (terminate) => {
        if (!readerClosed) { readerClosed = true; lines.close(); }
        if (!terminate || terminated) return;
        terminated = true;
        if (options.termination === "grace") terminateChild(child);
        else { child.stdin.end(); child.kill(); }
      },
    };
  }
}

function terminateChild(child: ChildProcessWithoutNullStreams): void {
  if (!child.stdin.destroyed) child.stdin.destroy();
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { child.kill(); } catch { return; }
  const force = setTimeout(() => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try { child.kill("SIGKILL"); } catch { /* Exited between check and signal. */ }
  }, TERMINATION_GRACE_MS);
  force.unref();
  child.once("exit", () => clearTimeout(force));
}
