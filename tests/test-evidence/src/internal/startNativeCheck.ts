import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { IRunResult } from "./IRunResult";
import { pluginCacheDirectory } from "./pluginCacheDirectory";

/**
 * Starts an actual published SDK-selected resident check sidecar.
 *
 * SDK preparation and capability discovery supply the executable, complete
 * manifest and project identity. Every request resolves current registration
 * again. A fresh resolved answer may lack reusable lookup proof; its actual
 * binary bytes, manifest and project context still determine process identity.
 * The authored caller keeps compiler options and source membership fixed.
 *
 * @evidence contracts/common.md#principled-implementation Real TtscCompiler.prepare and resolveCapabilityPluginResolution provide the built binary and verbatim manifest/context. Actual JSON responses supply status, output and PID/load telemetry; no diagnostic or verdict is reconstructed.
 * @evidence contracts/common.md#clear-and-simple-design One owner exposes serial observations, actual provenance and joined close. Fresh SDK registration and executable bytes are read before each request; independent callers collect assertion failures and decide later phases.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unavailable or empty selections fail explicitly. The initial selection requires actual reusable proof; later fresh answers report the SDK's true proof value rather than treating it as permission to execute. No earlier resolution answer is reused. Incompatible registration retires the actual process before a fresh one; protocol failures retire without retrying that phase or fabricating a result.
 * @evidence contracts/common.md#meaningful-documentation Distinguishes supported capability discovery, actual fixed-argv compatibility and native telemetry from launcher config reload behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable plus argv and Node pipes avoid shell parsing; SDK-produced paths/context retain native identity, while child closure rather than signal delivery establishes release.
 * @evidence contracts/performance.md#efficient-algorithms Requests and responses are serialized once; line processing retains only an incomplete response. Each fresh executable hash scales with its bytes, and the SDK entry is hashed once at startup. Registration lookup uses the SDK's own validated cache and may genuinely reevaluate changed config dependencies.
 * @evidence contracts/performance.md#reuse-equivalent-work Every observation recomputes SDK registration. Identical actual binary bytes/manifest/context with the caller's fixed compiler options and corpus can retain the native Program; telemetry and fresh registration remain available for caller assertions. Changed registration starts a real fresh host. A false SDK query is reported and never used to certify a cached lookup answer.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One owner retains at most one child, one pending response and stderr transcript. Protocol timers settle or retire the child, and close joins EOF/forced termination with bounded timers. Stderr history is not capped during this finite test lifetime.
 */
export function startNativeCheck(directory: string): INativeCheckSession {
  const require = createRequire(path.join(directory, "package.json"));
  const sdk = require("ttsc") as typeof import("ttsc");
  const inCache = <T>(operation: () => T): T => {
    const previous = process.env.TTSC_CACHE_DIR;
    try {
      process.env.TTSC_CACHE_DIR = pluginCacheDirectory();
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
  const prepared = inCache(() =>
    new sdk.TtscCompiler({
      cwd: directory,
      tsconfig: "tsconfig.json",
      cacheDir: pluginCacheDirectory(),
    }).prepare(),
  );
  const initial = select();
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
    async observe(
      changed: readonly string[] = [],
      external: readonly string[] = [],
    ): Promise<INativeCheckResult> {
      if (permanentlyClosed)
        throw new Error("The native check session is closed.");
      if (requestActive)
        throw new Error("Native check observations must be serial.");
      requestActive = true;
      try {
        const selected = select();
        if (current !== undefined && !same(current.registration, selected)) {
          await current.close();
          current = undefined;
        }
        current ??= open(directory, selected);
        try {
          return {
            ...(await current.request({ changed, external })),
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

/** Actual native response and its process-owned reuse telemetry. */
export interface INativeCheckResult extends IRunResult {
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

/** Owning SDK-selected native check lifetime and actual startup provenance. */
export interface INativeCheckSession {
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
  request(value: unknown): Promise<Omit<INativeCheckResult, "registration">>;
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
      env: { ...process.env, TTSC_CACHE_DIR: pluginCacheDirectory() },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let buffer = "";
  let stderr = "";
  let failure: unknown;
  let pending:
    | {
        resolve(value: Omit<INativeCheckResult, "registration">): void;
        reject(error: unknown): void;
      }
    | undefined;
  let closed = false;
  let closeOperation: Promise<void> | undefined;
  const closeObserved = new Promise<void>((resolve) =>
    child.once("close", () => {
      closed = true;
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
    ): Promise<Omit<INativeCheckResult, "registration">> {
      if (failure !== undefined) throw failure;
      if (closed) throw new Error("The native check child already closed.");
      let timer: NodeJS.Timeout | undefined;
      try {
        return await new Promise<Omit<INativeCheckResult, "registration">>(
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
        if (closed) return;
        let force: NodeJS.Timeout | undefined;
        let deadline: NodeJS.Timeout | undefined;
        try {
          child.stdin?.end();
          await Promise.race([
            closeObserved,
            new Promise<never>((_, fail) => {
              force = setTimeout(() => {
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
        } finally {
          if (force !== undefined) clearTimeout(force);
          if (deadline !== undefined) clearTimeout(deadline);
        }
      })();
      return closeOperation;
    },
  };
}
