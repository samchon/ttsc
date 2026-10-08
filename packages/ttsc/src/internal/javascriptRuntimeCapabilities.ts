import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { captureProcessOutput } from "../compiler/internal/captureProcessOutput";
import { SidecarEnvironment } from "../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "./E2ETrace";
import { OwnedSynchronousProcess } from "./OwnedSynchronousProcess";
import type { IJavaScriptRuntimeCapabilities } from "./IJavaScriptRuntimeCapabilities";
import { isSpawnSyncFdExhaustion } from "./isSpawnSyncFdExhaustion";
import { runtimeExecutableIdentity } from "./runtimeExecutableIdentity";
import { spawnSyncWithLowDescriptors } from "./spawnSyncWithLowDescriptors";

/**
 * Probe an interpreter instead of inferring its identity from the host.
 *
 * Successful absolute candidates can be reused only while their actual bytes,
 * lexical link and physical target agree. Preloaded, relative and wrapper
 * candidates are probed anew because those inputs can select mutable behavior.
 * Cache-ineligible candidates do not acquire executable proofs used only by
 * cache lookup and publication.
 *
 * @evidence contracts/common.md#principled-implementation A child reports its own feature availability and executable; byte-aware before/after identity and same-executable proof authorize reuse only for a stable absolute runtime without NODE_OPTIONS preload authority.
 * @evidence contracts/common.md#clear-and-simple-design One probe owner coordinates identity, spawning and parsing; the shared fingerprint helper owns file-content proof and the low-descriptor helper owns the POSIX launch distinction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Feature availability comes from the actual interpreter rather than its name; descriptor fallback handles a supported kernel constraint and failures produce unsupported capabilities, not fabricated success.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain measured capabilities, reuse restrictions and freshness, with comments separating platform launch and cache permission from tags.
 * @evidence contracts/portability.md#os-neutral-implementation Shared environment merge and lookup apply native name identity to caller precedence and NODE_OPTIONS preload authority, including Windows aliases; Node spawn receives an executable and argv without shell syntax, and only POSIX descriptor exhaustion uses the isolated broker.
 * @evidence contracts/performance.md#efficient-algorithms Environment merge/name handling first decides cache eligibility. Eligible hits read B executable bytes; eligible misses acquire before/after content proofs around the actual probe. Ineligible calls retain the fresh child without reading executable bytes solely for the forbidden cache. Probe spawning/parsing, a possible descriptor-exhaustion retry and capture-file reads add text/environment/native lookup costs and transient output storage; this adapter sets no explicit byte quota.
 * @evidence contracts/performance.md#reuse-equivalent-work Stable absolute candidates that report their own executable share measured capability results, including false feature flags; changed executable bytes, link/target identity, preload options or wrapper identity require another probe, while failed probes without executable identity are not reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous probe owns child completion and fallback captures; finally attempts capture close/removal, whose helper suppresses cleanup failures, so native/file release is unconfirmed on failure. Capability entries retain absolute spellings and path/identity text with no eviction quota; failed identity validation can remove an entry. Returned capability copies transfer to callers.
 */
export function javascriptRuntimeCapabilities(
  runtime: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): IJavaScriptRuntimeCapabilities {
  const effectiveEnv = SidecarEnvironment.merge(process.env, env);
  const cacheKey = runtimeCapabilityCacheKey(runtime, effectiveEnv);
  const beforeIdentity =
    cacheKey === undefined ? undefined : runtimeExecutableIdentity(runtime);
  if (cacheKey !== undefined && beforeIdentity !== undefined) {
    const cached = runtimeCapabilityCache.get(cacheKey);
    if (cached?.identity === beforeIdentity) return { ...cached.capabilities };
    runtimeCapabilityCache.delete(cacheKey);
  }
  const args = [
    "-e",
    `const Module = require("node:module"); process.stdout.write(JSON.stringify({ bun: typeof globalThis.Bun === "object", executable: process.execPath, registerHooks: typeof Module.registerHooks === "function" }));`,
  ];
  const options = {
    cwd,
    encoding: "utf8" as const,
    env: effectiveEnv,
    timeout: 30_000,
    windowsHide: true,
  };
  let result = E2ETrace.synchronous(
    runtime,
    args,
    options,
    "runtime-capability-probe",
    () =>
      OwnedSynchronousProcess.launch<string>(runtime, args, options) ??
      childProcess.spawnSync(runtime, args, options),
  );
  if (process.platform !== "win32" && isSpawnSyncFdExhaustion(result.error)) {
    const capture = captureProcessOutput();
    try {
      const retried = spawnSyncWithLowDescriptors(runtime, args, options, {
        stderr: capture.stderrPath,
        stdout: capture.stdoutPath,
      });
      const stdout = capture.read("stdout", "utf8") as string;
      const stderr = capture.read("stderr", "utf8") as string;
      result = {
        ...retried,
        output: [null, stdout, stderr],
        stderr,
        stdout,
      };
    } finally {
      capture.dispose();
    }
  }
  let capabilities: IJavaScriptRuntimeCapabilities = {
    bun: false,
    registerHooks: false,
  };
  if (result.status === 0) {
    try {
      const parsed = JSON.parse(
        result.stdout,
      ) as Partial<IJavaScriptRuntimeCapabilities>;
      capabilities = {
        bun: parsed.bun === true,
        ...(typeof parsed.executable === "string" &&
        path.isAbsolute(parsed.executable)
          ? { executable: path.resolve(parsed.executable) }
          : {}),
        registerHooks: parsed.registerHooks === true,
      };
    } catch {
      // An incompatible executable is not a Node runtime candidate.
    }
  }
  // Cache successful absolute candidates only when the child reports that same
  // executable and both its lexical link and physical target retain the same
  // filesystem and actual content identity. Relative/bare commands and wrappers can resolve
  // differently by cwd/PATH/environment, failed probes without an executable
  // identity can become valid later, and NODE_OPTIONS can load mutable user
  // code, so none of those states are memoized. A successful probe can report
  // false for either feature and still be reused under the executable proof.
  // This removes a process spawn from the common path without
  // authorizing a replaced or redirected runtime in a long-lived host.
  const afterIdentity =
    cacheKey === undefined ? undefined : runtimeExecutableIdentity(runtime);
  if (
    cacheKey !== undefined &&
    capabilities.executable !== undefined &&
    beforeIdentity !== undefined &&
    beforeIdentity === afterIdentity &&
    sameRuntimeExecutable(runtime, capabilities.executable)
  ) {
    runtimeCapabilityCache.set(cacheKey, {
      capabilities: { ...capabilities },
      identity: afterIdentity,
    });
  }
  return capabilities;
}

type RuntimeCapabilityCacheEntry = {
  capabilities: IJavaScriptRuntimeCapabilities;
  identity: string;
};

const runtimeCapabilityCache = new Map<string, RuntimeCapabilityCacheEntry>();

/** True when a probe ran the candidate itself rather than a mutable wrapper. */
function sameRuntimeExecutable(candidate: string, executable: string): boolean {
  try {
    const candidateStats = fs.statSync(candidate, { bigint: true });
    const executableStats = fs.statSync(executable, { bigint: true });
    return (
      (candidateStats.ino !== 0n &&
        candidateStats.dev === executableStats.dev &&
        candidateStats.ino === executableStats.ino) ||
      fs.realpathSync.native(candidate) === fs.realpathSync.native(executable)
    );
  } catch {
    return false;
  }
}

/** Stable cache key only for an absolute runtime with no preload authority. */
function runtimeCapabilityCacheKey(
  runtime: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (
    !path.isAbsolute(runtime) ||
    SidecarEnvironment.read(env, "NODE_OPTIONS")?.trim()
  )
    return undefined;
  return path.resolve(runtime);
}
