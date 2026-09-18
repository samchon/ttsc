import fs from "node:fs";
import path from "node:path";

import { CapabilityResolutionFormat } from "./CapabilityResolutionFormat";
import type { ITtscCapabilityResolutionEntry } from "./ITtscCapabilityResolutionEntry";
import type { ITtscCapabilityResolutionPlugin } from "./ITtscCapabilityResolutionPlugin";
import { hashHostInputPaths } from "./load/hashHostInputPaths";
import { realpathHostInputPaths } from "./load/realpathHostInputPaths";

/**
 * Record the answer and the state it was true for.
 *
 * A write failure is not reported. The cache is an optimization over a walk
 * that still works, and a read-only or full disk is a reason to be slower, not
 * a reason for `resolveCapabilityPlugins` to start throwing at a caller whose
 * contract is that it never does.
 */
export function writeCapabilityResolution(
  options: {
    cwd: string;
    tsconfig: string;
    version: string;
    env?: NodeJS.ProcessEnv;
  },
  answer: {
    hostInputs: readonly string[];
    manifest: string;
    projectContext: string | null;
    plugins: readonly ITtscCapabilityResolutionPlugin[];
  },
): void {
  const file = CapabilityResolutionFormat.resolutionFile(options);
  if (file === null) return;
  const hostInputs = [
    ...new Set(
      answer.hostInputs
        .filter((input) => input !== "")
        .map((input) => path.resolve(input)),
    ),
  ].sort();
  if (hostInputs.length === 0) return;
  const entry: ITtscCapabilityResolutionEntry = {
    hostInputHashes: hashHostInputPaths(hostInputs),
    hostInputRealpaths: realpathHostInputPaths(hostInputs),
    hostInputs,
    manifest: answer.manifest,
    plugins: [...answer.plugins],
    projectContext: answer.projectContext,
    sources: Object.fromEntries(
      [...new Set(answer.plugins.map((plugin) => plugin.source))]
        .filter((source) => source !== "")
        .map(
          (source) =>
            [
              source,
              CapabilityResolutionFormat.fingerprintDirectory(source),
            ] as const,
        ),
    ),
    version: CapabilityResolutionFormat.formatVersion(options.version),
  };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Written beside the target and renamed, so a reader never sees half an
    // entry: a truncated JSON parses as a failure and falls back, but a
    // partially written one could parse and be believed.
    const staging = `${file}.${String(process.pid)}.tmp`;
    fs.writeFileSync(staging, JSON.stringify(entry), "utf8");
    fs.renameSync(staging, file);
  } catch {
    return;
  }
}
