import { TestProject } from "@ttsc/testing";
import { WatchBuildObservation } from "../../../../../utils/src/WatchBuildObservation";
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
 * @evidence contracts/common.md#clear-and-simple-design One live child forwards original output/error/close events to its concrete observation owner; one memoized close operation supplies all callers with the same join result, and exitResult exposes only the real close event.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real native watch and public launcher execution remain intact. No method is replaced, timeout increased, failure converted to quiet success or killed launcher treated as descendant closure.
 * @evidence contracts/common.md#meaningful-documentation Describes the IPC join authority, actual stdio close and caller-owned tracked workspace/external-input lifetime; observation methods describe their build-count and idle-window meanings.
 * @evidence contracts/portability.md#os-neutral-implementation Executable plus argv and the supported Node IPC protocol work on Windows and POSIX without requiring Windows SIGTERM to invoke JavaScript signal handlers. Forced termination remains a failed join.
 * @evidence contracts/performance.md#efficient-algorithms The concrete observation owner scans accumulated stream bytes for markers; this process owner routes each original chunk once and retains no second transcript.
 * @evidence contracts/performance.md#reuse-equivalent-work All cycle and quiet assertions reuse the same immutable launcher/native session until their caller changes inputs; concurrent close callers share one nonce and one closure.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The concrete observation owner releases observation handles; close removes its message listener after actual closure. Missing/invalid join retains caller-declared tracked inputs and an already allocated shared plugin cache; callers must declare every separately owned input, and transcript bytes remain unbounded until this session is discarded.
 */
export class WatchSession {
  private readonly child: ReturnType<typeof child_process.spawn>;
  /** The session as its failures name it: the command line it runs. */
  private readonly label: string;
  private readonly observation: WatchBuildObservation;
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
      /** Installed launcher owned by the caller; defaults to the checkout CLI. */
      launcher?: string;
      env?: NodeJS.ProcessEnv;
      ownershipRoot?: string;
      ownedInputRoots?: readonly string[];
      watchFlag?: string;
    } = {},
  ) {
    this.label = [
      "ttsc",
      ...(options.args ?? []),
      options.watchFlag ?? "--watch",
    ].join(" ");
    this.observation = new WatchBuildObservation(this.label);
    const child = child_process.spawn(
      process.execPath,
      [
        options.launcher ?? ttscBin,
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
        this.observation.close();
        resolve();
      });
    });
    child.on("error", (error) => {
      this.startupError = error;
      this.observation.fail(error);
    });
    stdout.on("data", (chunk: Buffer) => this.observation.append(chunk.toString("utf8"), "stdout"));
    stderr.on("data", (chunk: Buffer) => this.observation.append(chunk.toString("utf8"), "stderr"));
    stdout.on("error", (error) => this.observation.fail(error));
    stderr.on("error", (error) => this.observation.fail(error));
  }

  /** Wait for actual complete or failed build markers, without an age ceiling. */
  public waitForBuilds(count: number): Promise<void> {
    return this.observation.waitForBuilds(count);
  }

  /** Await completed cycles and a finite interval with no additional start. */
  public waitForSettled(quiet = 2_000): Promise<void> {
    return this.observation.waitForSettled(quiet);
  }

  /** Assert no build starts or completes during a deliberate idle interval. */
  public waitForQuiet(duration = 900): Promise<void> {
    return this.observation.waitForQuiet(duration);
  }

  /** Return the combined stdout/stderr transcript observed so far. */
  public transcript(): string {
    return this.observation.transcript();
  }

  /** Reject an unmet consumer observation on actual session error or close. */
  public assertRunning(): void {
    this.observation.assertRunning();
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
   * invalid joined receipts retain tracked inputs. An unresolved close stays
   * pending until the native containing owner adjudicates operator cancellation.
   */
  public close(): Promise<void> {
    return (this.closeOperation ??= this.closeOwnedSession());
  }

  private async closeOwnedSession(): Promise<void> {
    const id = randomUUID();
    let receipt: number | null | undefined;
    let failure: Error | undefined;
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
          `${this.label} closed without an owning shutdown receipt:\n${this.transcript()}`,
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
      // Only the original close event ends this join. Operator cancellation is
      // owned by the containing native E2E entry, not an elapsed kill deadline.
      await this.closure;
      if (this.startupError !== undefined) failure ??= this.startupError;
      if (receipt === undefined)
        failure ??= new Error(
          `${this.label} omitted its joined shutdown receipt:\n${this.transcript()}`,
        );
      if (receipt === null && this.observation.completed() > 0)
        failure ??= new Error(
          `${this.label} omitted the completed build status:\n${this.transcript()}`,
        );
      if (
        this.child.signalCode !== null ||
        this.child.exitCode !== (receipt ?? 0)
      )
        failure ??= new Error(
          `${this.label} close disagrees with joined status ${receipt}: code=${this.child.exitCode}, signal=${this.child.signalCode}\n${this.transcript()}`,
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

  private assertNoUncaughtExit(): void {
    assert.equal(
      /Uncaught|UnhandledPromiseRejection/.test(this.transcript()),
      false,
      `ttsc --watch must terminate without an uncaught error:\n${this.transcript()}`,
    );
  }
}
