import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { performance } from "node:perf_hooks";

import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";
import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import { pluginCacheDirectory } from "../../../../../utils/src/evidence/pluginCacheDirectory";

/**
 * Starts an actual published SDK-selected resident check sidecar.
 *
 * SDK preparation and capability discovery supply the executable, complete
 * manifest and project identity. Every request resolves current registration
 * again. A fresh resolved answer may lack reusable lookup proof; its actual
 * binary bytes, manifest and project context still determine process identity.
 * The authored caller keeps compiler options and source membership fixed within
 * each lifetime and joins the old child before switching compiler families.
 * Monotonic helper timings distinguish preparation, fresh selection and native
 * response waits; they are separate from the actual protocol response.
 * Only normal native EOF shutdown with exit zero establishes release of its
 * synchronous config-loader children. Forced, nonzero or unjoined closure
 * permanently retains fixture and shared producer inputs and blocks writes.
 *
 * @evidence contracts/common.md#principled-implementation Real TtscCompiler.prepare and resolveCapabilityPluginResolution provide the built binary and verbatim manifest/context. Actual JSON responses supply status, output and PID/load telemetry; no diagnostic or verdict is reconstructed.
 * @evidence contracts/common.md#clear-and-simple-design One owner exposes serial observations, actual provenance and joined close. Fresh SDK registration and executable bytes are read before each request; independent callers collect assertion failures and decide later phases.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable or empty selections fail explicitly. The initial selection requires actual reusable proof; later fresh answers report the SDK's true proof value rather than treating it as permission to execute. No earlier resolution answer is reused. Incompatible registration retires the actual process before a fresh one; protocol failures retire without retrying that phase or fabricating a result.
 * @evidence contracts/common.md#meaningful-documentation Distinguishes supported capability discovery, actual fixed-argv compatibility and native telemetry from launcher config reload behavior. Helper wall times identify their real operation boundaries and are not asserted as protocol telemetry or performance benchmarks.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable plus argv and Node pipes avoid shell parsing; SDK-produced paths/context retain native identity. Normal EOF plus native exit zero establishes synchronous config-loader release; signals and forced parent closure remain unknown on every platform.
 * @evidence contracts/performance.md#efficient-algorithms Requests and responses are serialized once; line processing retains only an incomplete response. Each fresh executable hash scales with its bytes, and the SDK entry is hashed once at startup. Registration lookup uses the SDK's own validated cache and may genuinely reevaluate changed config dependencies.
 * @evidence contracts/performance.md#reuse-equivalent-work Every observation recomputes SDK registration. Identical actual binary bytes/manifest/context with the caller's fixed compiler options and corpus can retain the native Program; telemetry and fresh registration remain available for caller assertions. Changed registration starts a real fresh host. A false SDK query is reported and never used to certify a cached lookup answer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One owner retains at most one child, one pending response and stderr transcript. Close has bounded EOF and termination timers; force, nonzero exit or failure permanently retains fixture and existing shared producer/cache inputs because descendant release is unknown. Stderr history is not capped during this finite test lifetime.
 */
export function startNativeCheck(directory: string): INativeCheckSession {
  EvidenceProcessOwnership.assertAvailable(directory);
  const require = createRequire(path.join(directory, "package.json"));
  const sdk = require("ttsc") as typeof import("ttsc");
  const inCache = <T>(operation: () => T): T => {
    const previous = process.env.TTSC_CACHE_DIR;
    try {
      process.env.TTSC_CACHE_DIR = pluginCacheDirectory(directory);
      return operation();
    } finally {
      if (previous === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previous;
    }
  };
  const options = {
    capability: "residentCheck",
    cwd: directory,
    tsconfig: "tsconfig.json",
  };
  const digest = (filename: string): string =>
    createHash("sha256").update(fs.readFileSync(filename)).digest("hex");
  const select = (): IRegistration =>
    inCache(() => {
      const resolution = sdk.resolveCapabilityPluginResolution(options);
      assert.equal(
        resolution.status,
        "resolved",
        "The actual SDK must resolve the installed contributor.",
      );
      assert.equal(
        resolution.plugins.length,
        1,
        "The authored consumer selects exactly one resident check contributor.",
      );
      const selection = resolution.plugins[0]!;
      return {
        selection,
        binaryDigest: digest(selection.binary),
        reusableProof: resolution.isCurrent(),
      };
    });
  const preparationStarted = performance.now();
  const prepared = inCache(() =>
    new sdk.TtscCompiler({
      cwd: directory,
      tsconfig: "tsconfig.json",
      cacheDir: pluginCacheDirectory(directory),
    }).prepare(),
  );
  const prepareMilliseconds = performance.now() - preparationStarted;
  const initialSelectionStarted = performance.now();
  const initial = select();
  const initialSelectionMilliseconds =
    performance.now() - initialSelectionStarted;
  assert.ok(
    initial.reusableProof,
    "The initial SDK selection must have its actual reusable proof.",
  );
  assert.ok(
    prepared.includes(initial.selection.binary),
    "Capability discovery must select an actual SDK-prepared binary.",
  );
  const provenance = {
    sdk: require.resolve("ttsc"),
    sdkDigest: digest(require.resolve("ttsc")),
    ...initial.selection,
    binaryDigest: initial.binaryDigest,
  };
  let current: IProcess | undefined;
  let permanentlyClosed = false;
  let requestActive = false;
  const same = (left: IRegistration, right: IRegistration): boolean =>
    left.selection.binary === right.selection.binary &&
    left.selection.manifest === right.selection.manifest &&
    left.selection.projectContext === right.selection.projectContext &&
    left.binaryDigest === right.binaryDigest;
  return {
    provenance,
    preparationTiming: { prepareMilliseconds, initialSelectionMilliseconds },
    async observe(
      changed: readonly string[] = [],
      external: readonly string[] = [],
    ): Promise<INativeCheckResult> {
      if (permanentlyClosed)
        throw new Error("The native check session is closed.");
      EvidenceProcessOwnership.assertAvailable(directory);
      if (requestActive)
        throw new Error("Native check observations must be serial.");
      requestActive = true;
      try {
        const selectionStarted = performance.now();
        const selected = select();
        const freshSelectionMilliseconds = performance.now() - selectionStarted;
        if (current !== undefined && !same(current.registration, selected)) {
          try {
            await current.close();
          } catch (error) {
            permanentlyClosed = true;
            throw error;
          }
          current = undefined;
        }
        current ??= open(directory, selected);
        try {
          const requestStarted = performance.now();
          const response = await current.request({ changed, external });
          return {
            ...response,
            timing: {
              freshSelectionMilliseconds,
              nativeRequestMilliseconds: performance.now() - requestStarted,
            },
            registration: {
              ...selected.selection,
              binaryDigest: selected.binaryDigest,
              reusableProof: selected.reusableProof,
            },
          };
        } catch (error) {
          try {
            await current.close();
            current = undefined;
          } catch (release) {
            permanentlyClosed = true;
            throw new AggregateError(
              [error, release],
              "Native observation and retirement failed.",
            );
          }
          throw error;
        }
      } finally {
        requestActive = false;
      }
    },
    async close(): Promise<void> {
      permanentlyClosed = true;
      await current?.close();
      current = undefined;
    },
  };
}

/**
 * Actual native response and its process-owned reuse telemetry.
 *
 * @evidence contracts/common.md#principled-implementation Native status, streams and telemetry retain the validated real response; helper timings and fresh SDK registration are explicitly separate observations.
 * @evidence contracts/common.md#clear-and-simple-design One readonly result extends the ordinary captured consumer result with process telemetry and the selection used for this request.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No field certifies a fabricated verdict or reusable SDK answer; reusableProof reports the actual query and helper wall time is outside native telemetry.
 * @evidence contracts/common.md#meaningful-documentation Distinguishes actual native response fields from measured helper operations and freshly selected executable identity.
 */
export interface INativeCheckResult extends IRunResult {
  /** Helper wall times measured around real operations, outside the protocol. */
  readonly timing: {
    readonly freshSelectionMilliseconds: number;
    readonly nativeRequestMilliseconds: number;
  };
  readonly telemetry: {
    readonly pid: number;
    readonly programLoads: number;
    readonly programUpdates: number;
    readonly reused: boolean;
  };
  /**
   * Fresh SDK selection and executable bytes, not a fabricated native response
   * field.
   */
  readonly registration: import("ttsc").ITtscCapabilityPlugin & {
    readonly binaryDigest: string;
    readonly reusableProof: boolean;
  };
}

/**
 * Owning SDK-selected native check lifetime and actual startup provenance.
 *
 * @evidence contracts/common.md#principled-implementation The lifetime exposes real preparation and executable provenance, serial observations and an awaited close whose unknown-descendant failure remains observable.
 * @evidence contracts/common.md#clear-and-simple-design One readonly handle couples startup evidence with the two operations that own its resident process.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Provenance identifies actual SDK and native bytes; observe supplies no predetermined verdict, and close cannot substitute signal delivery for joined ownership.
 * @evidence contracts/common.md#meaningful-documentation Names startup timings and provenance separately from request results; optional projectContext follows the actual capability selection.
 */
export interface INativeCheckSession {
  /** Helper wall times for real preparation and its first capability lookup. */
  readonly preparationTiming: {
    readonly prepareMilliseconds: number;
    readonly initialSelectionMilliseconds: number;
  };
  readonly provenance: {
    readonly sdk: string;
    readonly sdkDigest: string;
    readonly binary: string;
    readonly binaryDigest: string;
    readonly manifest: string;
    readonly projectContext?: string;
  };
  observe(
    changed?: readonly string[],
    external?: readonly string[],
  ): Promise<INativeCheckResult>;
  close(): Promise<void>;
}

interface IProcess {
  registration: IRegistration;
  request(value: unknown): Promise<Omit<INativeCheckResult, "registration" | "timing">>;
  close(): Promise<void>;
}

interface IRegistration {
  selection: import("ttsc").ITtscCapabilityPlugin;
  binaryDigest: string;
  reusableProof: boolean;
}

/**
 * Owns one supported check-serve process; startup and response failures remain
 * observable.
 */
function open(directory: string, registration: IRegistration): IProcess {
  const { selection } = registration;
  const child: ChildProcess = spawn(
    selection.binary,
    [
      "check-serve",
      "--cwd",
      directory,
      "--tsconfig",
      "tsconfig.json",
      "--plugins-json",
      selection.manifest,
      ...(selection.projectContext === undefined
        ? []
        : ["--project-context-json", selection.projectContext]),
    ],
    {
      cwd: directory,
      env: { ...process.env, TTSC_CACHE_DIR: pluginCacheDirectory(directory) },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let buffer = "";
  let stderr = "";
  let failure: unknown;
  let pending:
    | {
        resolve(value: Omit<INativeCheckResult, "registration" | "timing">): void;
        reject(error: unknown): void;
      }
    | undefined;
  let closed = false;
  let closeOperation: Promise<void> | undefined;
  let forced = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  const closeObserved = new Promise<void>((resolve) =>
    child.once("close", (code, signal) => {
      closed = true;
      exitCode = code;
      exitSignal = signal;
      if (forced || code !== 0 || signal !== null)
        EvidenceProcessOwnership.retain(directory, new Error(
          "Native closure does not establish joined config descendants.",
          { cause: { code, signal, forced } },
        ));
      resolve();
      pending?.reject(
        failure ??
          new Error("Native check closed before its response.\n" + stderr),
      );
    }),
  );
  const reject = (error: unknown): void => {
    failure = error;
    pending?.reject(error);
  };
  child.on("error", reject);
  child.stdin?.on("error", reject);
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      try {
        if (pending === undefined)
          throw new Error(
            "The native sidecar emitted an unsolicited response.",
          );
        const value = JSON.parse(line) as Record<string, unknown>;
        const telemetry = value.telemetry as INativeCheckResult["telemetry"];
        if (
          !Number.isInteger(value.status) ||
          typeof value.stdout !== "string" ||
          typeof value.stderr !== "string" ||
          telemetry === null ||
          typeof telemetry !== "object" ||
          telemetry.pid !== child.pid ||
          !Number.isInteger(telemetry.programLoads) ||
          !Number.isInteger(telemetry.programUpdates) ||
          typeof telemetry.reused !== "boolean"
        )
          throw new Error(
            "The native sidecar emitted an invalid response: " + line,
          );
        pending.resolve({
          status: value.status as number,
          stdout: value.stdout,
          stderr: value.stderr,
          output: value.stdout + value.stderr,
          telemetry,
        });
        pending = undefined;
      } catch (error) {
        reject(error);
      }
    }
  });
  return {
    registration,
    async request(
      value: unknown,
    ): Promise<Omit<INativeCheckResult, "registration" | "timing">> {
      if (failure !== undefined) throw failure;
      if (closed) throw new Error("The native check child already closed.");
      let timer: NodeJS.Timeout | undefined;
      try {
        return await new Promise<Omit<INativeCheckResult, "registration" | "timing">>(
          (resolve, fail) => {
            pending = { resolve, reject: fail };
            timer = setTimeout(
              () =>
                fail(
                  new Error(
                    "The native sidecar did not answer within 120000 ms.\n" +
                      stderr,
                  ),
                ),
              120_000,
            );
            child.stdin!.write(JSON.stringify(value) + "\n", (error) => {
              if (error != null) reject(error);
            });
          },
        );
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        pending = undefined;
      }
    },
    close(): Promise<void> {
      if (closeOperation !== undefined) return closeOperation;
      closeOperation = (async () => {
        if (closed) {
          EvidenceProcessOwnership.assertAvailable(directory);
          return;
        }
        let force: NodeJS.Timeout | undefined;
        let deadline: NodeJS.Timeout | undefined;
        try {
          child.stdin?.end();
          await Promise.race([
            closeObserved,
            new Promise<never>((_, fail) => {
              force = setTimeout(() => {
                forced = true;
                EvidenceProcessOwnership.retain(directory, new Error(
                  "Native EOF shutdown required forced termination.",
                ));
                try {
                  child.kill("SIGKILL");
                } catch (error) {
                  fail(error);
                }
              }, 10_000);
              deadline = setTimeout(
                () =>
                  fail(
                    new Error(
                      "The native check child did not close after EOF and termination.",
                    ),
                  ),
                20_000,
              );
            }),
          ]);
          if (exitCode !== 0 || exitSignal !== null || forced)
            EvidenceProcessOwnership.assertAvailable(directory);
        } catch (error) {
          EvidenceProcessOwnership.retain(directory, error);
          throw error;
        } finally {
          if (force !== undefined) clearTimeout(force);
          if (deadline !== undefined) clearTimeout(deadline);
        }
      })();
      return closeOperation;
    },
  };
}
