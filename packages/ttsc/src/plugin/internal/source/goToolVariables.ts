import crypto from "node:crypto";

import { runtimeBuildEnvironment } from "../../../compiler/internal/build/runtimeBuildEnvironment";
import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Hash of every variable a Go tool receives, as the variable part of a Go
 * reading recorded for later processes.
 *
 * A Go tool receives the whole environment, so all of it is keyed except ttsc's
 * own per-run channels and reporting switches
 * (`runtimeBuildEnvironment.unkeyed`): a ttsx program carries channels naming
 * its run's directories, which no Go tool reads, and keying them recorded every
 * reading of every run under a new name (samchon/ttsc#1852).
 *
 * @param env Effective environment of the Go invocation.
 * @returns Hex SHA-256 of the name-ordered variables.
 * @evidence contracts/common.md#principled-implementation Every variable the tool receives is keyed; only ttsc's own channels, which no Go tool reads, are left out.
 * @evidence contracts/common.md#clear-and-simple-design One projection serves every recorded Go reading.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No shell or package-manager variable is named to be skipped.
 * @evidence contracts/common.md#meaningful-documentation Native prose states what is keyed, what is left out and why.
 * @evidence contracts/portability.md#os-neutral-implementation Names pass through the shared native-name merger, and the exclusion matches case-insensitively only on Windows.
 * @evidence contracts/performance.md#efficient-algorithms One sort and one pass over the variables.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure projection coordinates no shared work.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Nothing is retained.
 */
export function goToolVariables(env: NodeJS.ProcessEnv): string {
  const hash = crypto.createHash("sha256");
  for (const [name, value] of Object.entries(SidecarEnvironment.merge(env))
    .filter(
      (entry): entry is [string, string] =>
        entry[1] !== undefined && !runtimeBuildEnvironment.unkeyed(entry[0]),
    )
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
    hash.update(`\0${name.length}:${name}${value.length}:${value}`);
  return hash.digest("hex");
}
