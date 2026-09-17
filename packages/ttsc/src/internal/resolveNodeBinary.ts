import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { captureProcessOutput } from "../compiler/internal/captureProcessOutput";
import {
  isSpawnSyncFdExhaustion,
  spawnSyncWithLowDescriptors,
} from "./spawnSyncResilient";

export type JavaScriptRuntimeCapabilities = {
  bun: boolean;
  executable?: string;
  registerHooks: boolean;
};

type RuntimeCapabilityCacheEntry = {
  capabilities: JavaScriptRuntimeCapabilities;
  identity: string;
};

const runtimeCapabilityCache = new Map<string, RuntimeCapabilityCacheEntry>();

/** Probe an interpreter instead of inferring its identity from the host. */
export function javascriptRuntimeCapabilities(
  runtime: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): JavaScriptRuntimeCapabilities {
  const effectiveEnv = { ...process.env, ...env };
  const cacheKey = runtimeCapabilityCacheKey(runtime, effectiveEnv);
  const beforeIdentity = runtimeExecutableIdentity(runtime);
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
  let result = childProcess.spawnSync(runtime, args, options);
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
  let capabilities: JavaScriptRuntimeCapabilities = {
    bun: false,
    registerHooks: false,
  };
  if (result.status === 0) {
    try {
      const parsed = JSON.parse(
        result.stdout,
      ) as Partial<JavaScriptRuntimeCapabilities>;
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
  // filesystem identity. Relative/bare commands and wrappers can resolve
  // differently by cwd/PATH/environment, negative probes can become valid later,
  // and NODE_OPTIONS can load mutable user code, so none of those states are
  // memoized. This removes a process spawn from the common path without
  // authorizing a replaced or redirected runtime in a long-lived host.
  const afterIdentity = runtimeExecutableIdentity(runtime);
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
  if (!path.isAbsolute(runtime) || env.NODE_OPTIONS?.trim()) return undefined;
  return path.resolve(runtime);
}

/** Identity of an executable spelling and the physical file it selects. */
function runtimeExecutableIdentity(runtime: string): string | undefined {
  if (!path.isAbsolute(runtime)) return undefined;
  try {
    const lexical = fs.lstatSync(runtime, { bigint: true });
    const physicalPath = fs.realpathSync.native(runtime);
    const physical = fs.statSync(physicalPath, { bigint: true });
    return [
      physicalPath,
      lexical.dev,
      lexical.ino,
      lexical.mode,
      lexical.size,
      lexical.mtimeNs,
      lexical.ctimeNs,
      physical.dev,
      physical.ino,
      physical.mode,
      physical.size,
      physical.mtimeNs,
      physical.ctimeNs,
    ].join("\0");
  } catch {
    return undefined;
  }
}

/**
 * Locate a real Node runtime for ttsx and native JavaScript config loaders.
 *
 * Bun can directly evaluate a descriptor, but it does not implement the
 * synchronous `module.registerHooks` contract used by those loaders.
 */
export function resolveNodeBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | undefined {
  const candidates = [
    env.TTSC_NODE_BINARY,
    process.env.TTSC_NODE_BINARY,
    process.execPath,
    "node",
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (candidate === undefined || candidate.trim() === "") continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const capabilities = javascriptRuntimeCapabilities(candidate, env, cwd);
    if (
      !capabilities.bun &&
      capabilities.registerHooks &&
      capabilities.executable !== undefined
    ) {
      return capabilities.executable;
    }
  }
  return undefined;
}
