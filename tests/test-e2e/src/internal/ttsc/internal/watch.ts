import { TestProject } from "@ttsc/testing";
import { randomUUID } from "node:crypto";

import {
  assert,
  child_process,
  nativeBinary,
  tsgoBinary,
  ttscBin,
} from "./toolchain";

/**
 * A real `ttsc --watch` child with build-count and quiet-period assertions.
 *
 * The launcher receives an inherited IPC channel. Its nonce-bound stopped
 * receipt establishes that it joined active builds and native resident owners;
 * actual launcher/stdio close must agree before inputs can be reclaimed.
 * Callers supplying a nested project name its tracked workspace as
 * ownershipRoot and list separately tracked external inputs through
 * ownedInputRoots.
 *
 * @evidence contracts/common.md#principled-implementation Native build markers distinguish completed cycles from starts. Shutdown requires the supported launcher nonce receipt plus actual close and matching exit status, rather than assuming signal termination joined native descendants.
 * @evidence contracts/common.md#clear-and-simple-design One live child owns the transcript and observers; one memoized close operation supplies all callers with the same join result, and exitResult exposes only the real close event.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real native watch and public launcher execution remain intact. No method is replaced, timeout increased, failure converted to quiet success or killed launcher treated as descendant closure.
 * @evidence contracts/common.md#meaningful-documentation Describes the IPC join authority, actual stdio close and caller-owned tracked workspace/external-input lifetime; observation methods describe their build-count and idle-window meanings.
 * @evidence contracts/portability.md#os-neutral-implementation Executable plus argv and the supported Node IPC protocol work on Windows and POSIX without requiring Windows SIGTERM to invoke JavaScript signal handlers. Forced termination remains a failed join.
 * @evidence contracts/performance.md#efficient-algorithms Each output chunk updates counts by scanning the accumulated transcript; observation notification scales with active waiters. Transcript scanning is not claimed to be incremental.
 * @evidence contracts/performance.md#reuse-equivalent-work All cycle and quiet assertions reuse the same immutable launcher/native session until their caller changes inputs; concurrent close callers share one nonce and one closure.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Observation callbacks remove themselves on settlement; close removes its message listener and timer after actual closure. Missing/invalid/forced join retains caller-declared tracked inputs and an already allocated shared plugin cache; callers must declare every separately owned input, and transcript bytes remain unbounded until this session is discarded.
 */
export class WatchSession {
  private readonly child: ReturnType<typeof child_process.spawn>;
  /** The session as its failures name it: the command line it runs. */
  private readonly label: string;
  private readonly listeners = new Set<() => void>();
  private builds = 0;
  private buildStarts = 0;
  private output = "";
  private readonly ownedInputRoots: readonly string[];
  private closed = false;
  private startupError: Error | undefined;
  private readonly closure: Promise<void>;
  private closeOperation: Promise<void> | undefined;
  private exit:
    | { code: number | null; signal: NodeJS.Signals | null }
    | undefined;

  public constructor(
    root: string,
    options: {
      args?: readonly string[];
      env?: NodeJS.ProcessEnv;
      ownershipRoot?: string;
      ownedInputRoots?: readonly string[];
      watchFlag?: string;
    } = {},
  ) {
    const child = child_process.spawn(
      process.execPath,
      [
        ttscBin,
        ...(options.args ?? []),
        options.watchFlag ?? "--watch",
        "--cwd",
        root,
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          ...options.env,
          TTSC_BINARY: nativeBinary,
          TTSC_TSGO_BINARY: tsgoBinary,
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
      },
    );
    const { stderr, stdout } = child;
    if (stdout === null || stderr === null) {
      child.kill();
      throw new Error("ttsc --watch must expose piped stdout and stderr");
    }
    this.child = child;
    this.ownedInputRoots = [
      options.ownershipRoot ?? root,
      ...(options.ownedInputRoots ?? []),
    ];
    this.closure = new Promise<void>((resolve) => {
      child.once("close", (code, signal) => {
        this.exit = { code, signal };
        this.closed = true;
        for (const listener of this.listeners) listener();
        resolve();
      });
    });
    child.on("error", (error) => {
      this.startupError = error;
      for (const listener of this.listeners) listener();
    });
    this.label = [
      "ttsc",
      ...(options.args ?? []),
      options.watchFlag ?? "--watch",
    ].join(" ");
    const onChunk = (chunk: Buffer): void => {
      this.output += chunk.toString("utf8");
      this.builds = (
        this.output.match(/\[ttsc\] watch build (?:complete|failed)/g) ?? []
      ).length;
      this.buildStarts = (
        this.output.match(/\[ttsc\] rebuilding at /g) ?? []
      ).length;
      for (const listener of this.listeners) listener();
    };
    stdout.on("data", onChunk);
    stderr.on("data", onChunk);
  }

  /** Wait until at least `count` build completions have been observed. */
  public waitForBuilds(count: number, timeout = 120_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.listeners.delete(check);
        resolve();
      };
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        reject(
          new Error(
            `${this.label} did not reach ${count} builds:\n${this.output}`,
          ),
        );
      }, timeout);
      const check = (): void => {
        if (this.builds >= count) finish();
        else if (this.startupError !== undefined || this.closed) {
          clearTimeout(timer);
          this.listeners.delete(check);
          reject(
            this.startupError ??
              new Error(
                `${this.label} exited before ${count} builds:\n${this.output}`,
              ),
          );
        }
      };
      this.listeners.add(check);
      check();
    });
  }

  /**
   * Wait until every started build has completed and none starts for `quiet`
   * milliseconds, so a rerun queued while a long build ran has run too.
   */
  public async waitForSettled(quiet = 2_000, timeout = 300_000): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
      const starts = this.buildStarts;
      await new Promise((resolve) => setTimeout(resolve, quiet));
      this.assertRunning();
      if (this.buildStarts === starts && this.builds >= starts) return;
      assert.ok(
        Date.now() < deadline,
        `${this.label} never settled:\n${this.output}`,
      );
    }
  }

  /** Assert that no additional build lands during a deliberate idle period. */
  public waitForQuiet(duration = 900): Promise<void> {
    const initialBuilds = this.builds;
    const initialBuildStarts = this.buildStarts;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        try {
          this.assertRunning();
          resolve();
        } catch (error) {
          reject(error);
        }
      }, duration);
      const check = (): void => {
        if (this.closed || this.startupError !== undefined) {
          clearTimeout(timer);
          this.listeners.delete(check);
          reject(
            this.startupError ??
              new Error(
                `${this.label} exited during quiet observation:\n${this.output}`,
              ),
          );
          return;
        }
        if (
          this.builds === initialBuilds &&
          this.buildStarts === initialBuildStarts
        ) {
          return;
        }
        clearTimeout(timer);
        this.listeners.delete(check);
        reject(
          new Error(
            `${this.label} rebuilt during an idle period:\n${this.output}`,
          ),
        );
      };
      this.listeners.add(check);
    });
  }

  /** Return the combined stdout/stderr transcript observed so far. */
  public transcript(): string {
    return this.output;
  }

  /** Actual launcher/stdio closure result; absent while the session is live. */
  public exitResult():
    | { code: number | null; signal: NodeJS.Signals | null }
    | undefined {
    return this.exit;
  }

  /**
   * Request owning native-session shutdown over IPC and join launcher stdio.
   *
   * A killed launcher alone does not establish descendant closure. Missing or
   * invalid joined receipts retain tracked inputs even after forced close.
   */
  public close(): Promise<void> {
    return (this.closeOperation ??= this.closeOwnedSession());
  }

  private async closeOwnedSession(): Promise<void> {
    const id = randomUUID();
    let receipt: number | null | undefined;
    let failure: Error | undefined;
    let timer: NodeJS.Timeout | undefined;
    const onMessage = (value: unknown): void => {
      if (typeof value !== "object" || value === null) return;
      const message = value as Record<string, unknown>;
      if (message.type !== "ttsc.watch.stopped" || message.id !== id) return;
      if (
        message.status !== null &&
        !(
          typeof message.status === "number" &&
          Number.isInteger(message.status) &&
          message.status >= 0 &&
          message.status <= 255
        )
      )
        failure ??= new Error(
          `${this.label} returned an invalid joined status`,
        );
      else receipt = message.status;
    };
    this.child.on("message", onMessage);
    try {
      if (this.closed || !this.child.connected) {
        failure = new Error(
          `${this.label} closed without an owning shutdown receipt:\n${this.output}`,
        );
      } else {
        try {
          this.child.send({ type: "ttsc.watch.stop", id }, (error) => {
            if (error !== null) failure ??= error;
          });
        } catch (error) {
          failure = new Error(`${this.label} could not request shutdown`, {
            cause: error,
          });
        }
      }
      timer = setTimeout(() => {
        failure ??= new Error(
          `${this.label} did not join shutdown:\n${this.output}`,
        );
        try {
          this.retainInputs(failure);
        } catch (error) {
          failure = new Error(
            `${this.label} could not retain unresolved inputs`,
            { cause: new AggregateError([failure, error]) },
          );
        }
        try {
          this.child.kill("SIGKILL");
        } catch (error) {
          failure = new Error(
            `${this.label} could not terminate its launcher`,
            { cause: new AggregateError([failure, error]) },
          );
        }
      }, 30_000);
      // Even escalation joins actual close: a timeout never authorizes deleting
      // inputs that an unproved descendant may still read.
      await this.closure;
      if (this.startupError !== undefined) failure ??= this.startupError;
      if (receipt === undefined)
        failure ??= new Error(
          `${this.label} omitted its joined shutdown receipt:\n${this.output}`,
        );
      if (receipt === null && this.builds > 0)
        failure ??= new Error(
          `${this.label} omitted the completed build status:\n${this.output}`,
        );
      if (
        this.child.signalCode !== null ||
        this.child.exitCode !== (receipt ?? 0)
      )
        failure ??= new Error(
          `${this.label} close disagrees with joined status ${receipt}: code=${this.child.exitCode}, signal=${this.child.signalCode}\n${this.output}`,
        );
      if (failure !== undefined) throw failure;
      this.assertNoUncaughtExit();
    } catch (error) {
      try {
        this.retainInputs(error);
      } catch (retentionError) {
        throw new AggregateError(
          [error, retentionError],
          `${this.label} shutdown and input retention failed`,
        );
      }
      throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      this.child.removeListener("message", onMessage);
    }
  }

  private retainInputs(error: unknown): void {
    const reason = `${this.label} has unresolved native ownership: ${String(error)}`;
    const failures: unknown[] = [];
    for (const root of this.ownedInputRoots) {
      try {
        TestProject.retainTemporaryDirectory(root, reason);
      } catch (failure) {
        failures.push(failure);
      }
    }
    try {
      TestProject.retainSharedPluginCache(reason);
    } catch (failure) {
      failures.push(failure);
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "watch input retention authority failed",
      );
  }

  private assertRunning(): void {
    if (this.startupError !== undefined) throw this.startupError;
    assert.equal(
      this.closed,
      false,
      `${this.label} exited during observation:\n${this.output}`,
    );
  }

  private assertNoUncaughtExit(): void {
    assert.equal(
      /Uncaught|UnhandledPromiseRejection/.test(this.output),
      false,
      `ttsc --watch must terminate without an uncaught error:\n${this.output}`,
    );
  }
}

/**
 * How long a watch test waits for an event it has already caused.
 *
 * These tests assert that a notification arrives, never how quickly, so the
 * bound only has to exceed the slowest backend that still works. macOS
 * coalesces FSEvents and delivers them on its own schedule, which under CI load
 * runs well past a few seconds; the same suite already allows two minutes for a
 * build. A generous bound costs a healthy run nothing, because every waiter
 * polls and returns the moment its predicate holds, and it keeps a slow
 * delivery from being reported as a missing one.
 */
export const WATCH_EVENT_DEADLINE_MS = 30_000;
