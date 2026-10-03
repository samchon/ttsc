import { GraphProcessTrace } from "../internal/GraphProcessTrace";
import readline from "node:readline";

const TERMINATION_GRACE_MS = 1_000;

/**
 * Native line transport shared by graph and lint resident owners.
 *
 * @evidence contracts/common.md#principled-implementation Node stdout line framing and explicit process events preserve the native protocols while request correlation remains with their state owners.
 * @evidence contracts/common.md#clear-and-simple-design A connection exposes only liveness, diagnostics, writes and retirement; EOF retirement and authoritative process/stdio joining serve both state owners.
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
    /** Up to the last 65,536 UTF-16 code units of diagnostics when capture is selected. */
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
     * Detach the reader, or end stdin and await the owned process and stdio.
     *
     * @evidence contracts/common.md#principled-implementation Reader retirement is distinct from joined shutdown; repeated close(true) returns the same completion, which rejects unknown or forced termination.
     * @evidence contracts/common.md#clear-and-simple-design The signature transfers only its stated process operation or event; resident state owns protocol decisions.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts Node-native representations remain explicit rather than shell strings, process stand-ins or replaced foreign methods.
     * @evidence contracts/common.md#meaningful-documentation Native member prose states event, liveness or retirement meaning needed by the state owner.
     * @evidenceExclude contracts/performance.md#efficient-algorithms This boundary signature defines an operation or event; open and its returned adapter implementations own the work.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work The boundary descriptor computes no reusable graph result; state coordinates continued peer reuse.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The signature acquires no handle itself; open and the returned close implementation own actual lifetime.
     * @evidence contracts/portability.md#os-neutral-implementation Node numeric exit status, signal names, stdin callbacks and decoded line strings preserve native process semantics without assuming shell quoting or platform path spelling.
     */
    close(terminate: boolean): void | Promise<void>;
  }

  /**
   * Open the actual Node child and attach its reader and diagnostic drain.
   *
   * EOF permits the resident loop to finish. close(true) resolves only after
   * Node joins the process and all stdio with exit zero; a transport failure,
   * nonzero exit, signal, forced kill or unjoined deadline rejects instead.
   *
   * @evidence contracts/common.md#principled-implementation Node spawn and readline map executable, argv and complete lines to the declared transport operations without interpreting graph facts.
   * @evidence contracts/common.md#clear-and-simple-design One adapter implements actual process I/O; resident state owners choose diagnostic capture while this adapter owns joined EOF shutdown.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Real process APIs retain their defaults and explicit argv; no test-only executable or response path is supplied.
   * @evidence contracts/common.md#meaningful-documentation Prose explains EOF completion and unknown/forced failure and connection comments describe bounded stderr and retirement.
   * @evidence contracts/performance.md#efficient-algorithms One spawn/reader setup is constant-count; writes and line decoding process frame bytes once, while captured diagnostics retain a tail of at most 65,536 UTF-16 code units and draining avoids pipe backpressure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This effectful opener creates one native peer; resident state determines when that peer remains reusable or must be replaced.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The returned close owns one reader and child, detaches once and terminates at most once; a delivery deadline bounds an unread pipe after the caller yields, while child grace starts after EOF delivery. Streams drain through authoritative completion; an unjoined deadline first rejects and then releases only this connection's handles without terminating foreign pipe holders.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn receives an executable and argv vector directly with windowsHide; Node stream/process APIs own native signals and optional cwd, without a shell or manual path normalization.
   */
  export function open(
    binary: string,
    args: string[],
    events: Events,
    options: { cwd?: string; stderr: "capture" | "drain" },
  ): Connection {
    const child = GraphProcessTrace.spawn(binary, args, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    const lines = readline.createInterface({ input: child.stdout });
    let stderr = "";
    let readerClosed = false;
    let terminated = false;
    let joined = false;
    let forced = false;
    let joinFailed = false;
    let failure: Error | undefined;
    let force: ReturnType<typeof setTimeout> | undefined;
    let flushDeadline: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const completion = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    // Existing fire-and-forget disposal remains safe; awaiting the original
    // promise still exposes failure instead of turning it into joined success.
    void completion.catch(() => undefined);
    child.on("error", (error) => { failure = error; });
    for (const stream of [child.stdin, child.stdout, child.stderr])
      stream.on("error", (error) => { failure = error; events.error(error); });
    child.once("close", (code, signal) => {
      joined = true;
      if (force !== undefined) clearTimeout(force);
      if (flushDeadline !== undefined) clearTimeout(flushDeadline);
      if (deadline !== undefined) clearTimeout(deadline);
      if (joinFailed) return;
      if (failure !== undefined || forced || code !== 0 || signal !== null)
        reject(failure ?? new Error(`@ttsc/graph: peer shutdown failed (code=${String(code)}, signal=${String(signal)}, forced=${forced})`));
      else resolve();
    });
    const captureStderr = (chunk: string) => { stderr = (stderr + chunk).slice(-64 * 1024); };
    if (options.stderr === "capture") {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", captureStderr);
    } else child.stderr.resume();
    lines.on("line", events.line);
    child.on("error", events.error);
    child.on("exit", events.exit);
    const forceTerminationAndJoin = () => {
      if (joined || deadline !== undefined) return;
      if (child.exitCode === null && child.signalCode === null) {
        forced = true;
        try { child.kill("SIGKILL"); } catch (error) { failure = error instanceof Error ? error : new Error(String(error)); }
      }
      deadline = setTimeout(() => {
        if (joined) return;
        // Failure is final before destroying our streams can induce Node close.
        // Foreign descendants may retain inherited pipe endpoints; release our
        // endpoints without claiming their lifetime was joined or killing them.
        joinFailed = true;
        reject(new Error("@ttsc/graph: peer shutdown could not be joined"));
        if (force !== undefined) clearTimeout(force);
        if (flushDeadline !== undefined) clearTimeout(flushDeadline);
        if (deadline !== undefined) clearTimeout(deadline);
        lines.removeListener("line", events.line);
        lines.close();
        child.removeListener("error", events.error);
        child.removeListener("exit", events.exit);
        child.stderr.removeListener("data", captureStderr);
        for (const stream of [child.stdin, child.stdout, child.stderr]) stream.destroy();
        child.unref();
      }, TERMINATION_GRACE_MS);
    };
    const startTerminationGrace = () => {
      if (flushDeadline !== undefined) clearTimeout(flushDeadline);
      if (joined || force !== undefined || deadline !== undefined) return;
      force = setTimeout(forceTerminationAndJoin, TERMINATION_GRACE_MS);
    };
    return {
      get stderr() { return stderr; },
      alive: () => child.exitCode === null && child.signalCode === null,
      write: (line, done) => { child.stdin.write(line, done); },
      close: (terminate) => {
        if (!readerClosed) { readerClosed = true; lines.close(); }
        if (!terminate) return;
        if (terminated || joined) return completion;
        terminated = true;
        // Keep output drained until Node's close event joins both the process
        // and inherited stdio. EOF permits the real resident loop to finish.
        child.stdout.resume();
        // The child cannot act on EOF until the pipe finishes. Starting its
        // grace period before that callback charged a blocked parent event
        // loop against a shutdown request it had not yet delivered.
        if (!child.stdin.destroyed) {
          try {
            child.stdin.end(startTerminationGrace);
            // An unread pipe can prevent the EOF callback indefinitely. Start
            // delivery's own deadline only after synchronous caller work yields.
            queueMicrotask(() => {
              if (joined || force !== undefined || deadline !== undefined) return;
              flushDeadline = setTimeout(forceTerminationAndJoin, TERMINATION_GRACE_MS);
            });
          } catch (error) {
            failure = error instanceof Error ? error : new Error(String(error));
            child.stdin.destroy();
            startTerminationGrace();
          }
        } else startTerminationGrace();
        return completion;
      },
    };
  }
}

